pragma solidity 0.5.10;

import "./../../Wallet.sol";
import "./../../common/Collector.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract FeeTransactionBridge is Collector, ReentrancyGuard {

    IERC20 public token;

    constructor (address _tokenAddress, address _collector) Collector(_collector) public {
        token = IERC20(_tokenAddress);
    }

    function execute(
        address _to,
        uint256 _value,
        uint256 _fee,
        bytes calldata _signature
    ) nonReentrant external {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _to,
                _value,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "Invalid signature");
        require(token.transferFrom(msg.sender, _to, _value));
        require(token.transferFrom(msg.sender, getCollector(), _fee));
    }

}
