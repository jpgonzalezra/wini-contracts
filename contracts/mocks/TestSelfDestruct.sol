pragma solidity 0.5.10;


contract TestSelfDestruct {
    function() external payable {
        selfdestruct(msg.sender);
    }
}
