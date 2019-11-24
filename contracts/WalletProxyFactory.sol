pragma solidity 0.5.10;

import "./Wallet.sol";
import "./WalletProxy.sol";

/// @title WalletProxyFactory
/// @notice WalletProxyFactory creates all Wini wallets
/// every address has a designated wallet
/// and can send transactions by signing meta transactions
///
/// @dev All wallets are proxies pointing to a single
/// source contract, to make deployment costs viable
contract WalletProxyFactory is WalletProxy {

    // emit event when creating the wallet with create2 opcode
    event Deployed(address _walletAddress);

    // Random Invalid signer address, intents signed with this address are invalid
    address private constant INVALID_ADDRESS = address(0x00000000000000000000000000000FFFfffFFFFF);

    // Prefix of create2 address formula (EIP-1014)
    bytes1 private constant CREATE2_PREFIX = byte(0xff);

    // Bytecode to deploy wallets
    bytes public deploymentBytecode;

    // Hash of the deployment bytecode, this is used to calculate create2 result
    bytes32 public hash;

    // source contract, all proxies point here
    address public walletImplementation;

    /// @notice Creates a new WalletProxyFactory
    ///         with wallets pointing to the _source contract reference
    /// @param _source pointing to the source contract reference
    constructor(address payable _source) public {
        // Generate and save wallet creator deployment bytecode using the provided '_source'
        deploymentBytecode = getInitCode(_source);

        // apply keccak256 to initCode for get hash
        hash = keccak256(deploymentBytecode);

        // Destroy the '_source' provided, if is not disabled
        Wallet wini = Wallet(_source);
        if (wini.signer() == address(0)) {
            wini.init(INVALID_ADDRESS);
        }

        // Validate, the signer of _source should be "INVALID_ADDRESS" (disabled)
        require(wini.signer() == INVALID_ADDRESS, "Error init Wallet source");

        // Save the _source address, casting to address (160 bits)
        walletImplementation = address(wini);
    }

    /// @notice Calculates the wallet for a given signer
    /// @dev the wallet contract will be deployed in a deterministic manner
    /// @param _signer address to signer
    function getWalletAddress(address _signer) external view returns (address) {
        // get CREATE2 address
        return address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        CREATE2_PREFIX,
                        address(this),
                        bytes32(uint256(_signer)), /// salt
                        hash
                    )
                )
            )
        );
    }

    /// @notice Deploys the wini wallet of a given _signer
    /// @dev all ETH sent will be forwarded to the wallet
    /// @param _signer the signer is used with salt for create wallet
    function createWallet(address _signer) external payable {
        // Load init code from storage
        bytes memory proxyCode = deploymentBytecode;

        // Create wallet proxy using CREATE2
        Wallet wallet;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            wallet := create2(
                0, // amount ETH
                add(proxyCode, 0x20),
                mload(proxyCode),
                _signer // salt
            )
        }

        // Init wallet with provided _signer
        // and forward all Ether
        wallet.init.value(msg.value)(_signer);
        emit Deployed(address(wallet));
    }
}
