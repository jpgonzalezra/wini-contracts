pragma solidity 0.5.10;


contract TestOutOfGasContract {
    
    function() external payable {
        _fallback();
    }

    function _fallback() internal {
        uint256 a = 1;
        while (true) {
            a++;
        }
    }
}
