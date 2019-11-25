pragma solidity 0.5.10;

import "./../../Wallet.sol";
import "./../../common/ReceiptERC20Fee.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

/// @dev charges the end user for gas costs in an application-specific ERC20 token
contract FeeTransactionBridge is ReceiptERC20Fee, ReentrancyGuard {

    constructor (
        address _tokenAddress,
        address _collector
    ) public ReceiptERC20Fee(_tokenAddress, _collector)  {
        // solhint-disable-previous-line no-empty-blocks
    }

    function execute(
        address _to,
        uint256 _value,
        uint256 _fee,
        bytes calldata _signature
    ) external nonReentrant {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _to,
                _value,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "FeeTransactionBridge/invalid-signature"); //TODO: Is this necessary?
        require(token.transferFrom(msg.sender, _to, _value));
        transferFee(_fee);
    }

}
