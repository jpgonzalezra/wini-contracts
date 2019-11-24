pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Collector is Ownable {
    address private collector;

    event CollectorTransferred(address indexed previousCollector, address indexed newCollector);

    /// @dev Initializes the contract setting collector.
    constructor (address _collector) internal {
        require(_collector != address(0), "Collector/collector-zero-address");
        collector = _collector;
        emit CollectorTransferred(address(0), _collector);
    }

    /// @dev Returns the address of the current collector.
    function getCollector() public view returns (address) {
        return collector;
    }

    /// @dev Transfers collector of the contract to a new account (`newCollector`).
    /// Can only be called by the current owner.
    function transferRelayer(address newCollector) public onlyOwner {
        require(newCollector != address(0), "Collector/new-collector-zero-address");
        emit CollectorTransferred(collector, newCollector);
        collector = newCollector;
    }

}
