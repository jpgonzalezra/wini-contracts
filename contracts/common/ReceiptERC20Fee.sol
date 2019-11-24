pragma solidity 0.5.10;

import "./Collector.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/// @dev charges the end user for gas costs in an application-specific ERC20 token
contract ReceiptERC20Fee is Collector {

    IERC20 public token;

    constructor (
        address _tokenAddress,
        address _collector
    ) Collector(_collector) public {
        token = IERC20(_tokenAddress);
    }

    function transferFee(uint256 _fee) internal {
        require(token.transferFrom(msg.sender, getCollector(), _fee), "ReceiptERC20Fee/transferFrom-revert");
    }

}
