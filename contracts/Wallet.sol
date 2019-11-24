pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";


/// @title Wallet
/// @notice meta transactions wallet
/// @dev It has a signer, and it accepts signed messages ´Intents´ (Meta-Txs)
///       all messages are composed by an interpreter and a ´data´ field.
contract Wallet {

    event IntentRelayed(bytes32 indexed _id, address _executor, bytes _data);
    event IntentCanceled(bytes32 indexed _id);
    event Fallback(address _from, uint256 _amount);

    // Random Invalid signer address, the intents signed with this address are invalid
    address private constant INVALID_ADDRESS = address(0x00000000000000000000000000000FFFfffFFFFF);

    // Random slot to store signer
    bytes32 private constant SIGNER_SLOT = keccak256("wallet.signer.slot");

    // [1 bit (canceled) 95 bits (block) 160 bits (relayer)]
    mapping(bytes32 => bytes32) private intentReceipt;

    // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;

    function() external payable {
        emit Fallback(msg.sender, msg.value);
    }

    /// @notice initialize wallet, any address can Init
    /// @param _signer the signer address
    /// @dev it must be called using another contract
    function init(address _signer) external payable {
        address existentSigner;
        bytes32 signerSlot = SIGNER_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly { existentSigner := sload(signerSlot) }
        require(existentSigner == address(0), "Wallet already defined");
        // solhint-disable-next-line no-inline-assembly
        assembly { sstore(signerSlot, _signer) }
    }

    /// @notice get signer address
    /// @dev this address can perform transactions by signing intents
    /// @return _signer address
    function signer() public view returns (address _signer) {
        bytes32 signerSlot = SIGNER_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly { _signer := sload(signerSlot) }
    }

    /// @notice Address that relayed the `_id` intent
    /// @param _id intent id
    /// @dev address(0) if the intent was not relayed
    /// @return relayer address
    function getIntentRelayer(bytes32 _id) external view returns (address _relayer) {
        (, , _relayer) = _decodeReceipt(intentReceipt[_id]);
    }

    /// @notice Block when the intent was relayed, 0 if the intent was not relayed
    /// @param _id intent id
    function getBlockOfIntentExecution(bytes32 _id) external view returns (uint256 _block) {
        (, _block, ) = _decodeReceipt(intentReceipt[_id]);
    }

    /// @param _id intent id
    /// @dev True if the intent was canceled
    ///      An executed intent can't be canceled and
    ///      a IntentCanceled intent can't be executed
    function isIntentCanceled(bytes32 _id) external view returns (bool _canceled) {
        (_canceled, , ) = _decodeReceipt(intentReceipt[_id]);
    }

    /// @notice Relay a signed intent
    /// @param _executor implementation to be execute
    /// @param _data data to be execute
    /// @param _signature signature of data signed by signer
    /// @return result of the 'delegatecall' execution
    /// @dev Delegates execution to an implementation contract.
    ///      The same _executor and _data combination can only be relayed once
    ///      The implementation receives data containing the id of the 'intent' and its data,
    ///      and it will perform all subsequent calls.
    function relayIntent(
        address _executor,
        bytes calldata _data,
        bytes calldata _signature
    ) external payable returns (
        bytes memory result
    ) {
        // Calculate ID from (this, _executor, data)
        // Any change in _data results in a different ID
        bytes32 id = keccak256(
            abi.encodePacked(
                address(this),
                _executor,
                keccak256(_data)
            )
        );

        // Read receipt only once, if the receipt is 0, the Intent was not canceled or relayed
        if (intentReceipt[id] != bytes32(0)) {
            // Decode the receipt and determine if the Intent was canceled or relayed
            (bool canceled, , address relayer) = _decodeReceipt(intentReceipt[id]);
            require(relayer == address(0), "Intent already relayed");
            require(!canceled, "Intent was canceled");
            revert("Unknown error");
        }

        // Read the signer from storage, avoid multiple 'sload' ops
        address _signer = signer();

        // The signer 'INVALID_ADDRESS' is considered invalid and it will always throw
        // this is meant to disable the wallet safely
        require(_signer != INVALID_ADDRESS, "Signer is not a valid address");

        // Validate the _signer is the msg.sender or that the provided signature is valid
        require(_signer == msg.sender || _signer == ECDSA.recover(id, _signature), "Invalid signature");

        // Save the receipt before performing any other action
        intentReceipt[id] = _encodeReceipt(false, block.number, msg.sender);

        // Emit the 'IntentRelayed' event
        emit IntentRelayed(id, _executor, _data);

        // Perform 'delegatecall' to _executor, appending the id of the intent
        // to the beginning of the _data.
        bool success;
        // solhint-disable-next-line avoid-low-level-calls
        (success, result) = _executor.delegatecall(abi.encode(id, _data));

        // If the 'delegatecall' failed, reverts the transaction
        // forwarding the revert message
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /// @notice Cancels a not executed Intent '_id'
    /// @param _id intent id
    /// @dev a canceled intent can't be executed
    function cancel(bytes32 _id) external {
        require(msg.sender == address(this), "Only wallet can cancel txs");

        if (intentReceipt[_id] != bytes32(0)) {
            (bool canceled, , address relayer) = _decodeReceipt(intentReceipt[_id]);
            require(relayer == address(0), "Intent already relayed");
            require(!canceled, "Intent was canceled");
            revert("Unknown error");
        }

        emit IntentCanceled(_id);
        intentReceipt[_id] = _encodeReceipt(true, 0, address(0));
    }

    /// @notice Encodes an Intent receipt into a single bytes32
    /// @param _canceled status
    /// @param _block number block
    /// @param _relayer relayer address
    /// @dev canceled (1 bit) + block (95 bits) + relayer (160 bits)
    ///      Does not validate the _block length,
    ///      a _block overflow would not corrupt the wallet state
    function _encodeReceipt(
        bool _canceled,
        uint256 _block,
        address _relayer
    ) internal pure returns (bytes32 _receipt) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _receipt := or(shl(255, _canceled), or(shl(160, _block), _relayer))
        }
    }

    /// @notice Decodes an Intent receipt
    /// @param _receipt decode an intent receipt
    /// @dev reverse of _encodeReceipt(bool,uint256,address)
    function _decodeReceipt(bytes32 _receipt) internal pure returns (
        bool _canceled,
        uint256 _block,
        address _relayer
    ) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _canceled := shr(255, _receipt)
            _block := and(shr(160, _receipt), 0x7fffffffffffffffffffffff)
            _relayer := and(_receipt, 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }

    /// @dev Used to receive ERC721 tokens
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return _ERC721_RECEIVED;
    }

}
