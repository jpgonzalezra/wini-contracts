pragma solidity 0.5.10;


contract TestTransfer {
    function transfer(address payable _to) external payable {
        _to.transfer(msg.value);
    }
}
