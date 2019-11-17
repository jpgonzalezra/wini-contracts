pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Relayable is Ownable {
    address private relayer;

    event RelayerTransferred(address indexed previousRelayer, address indexed newRelayer);

    /**
     * @dev Initializes the contract setting the deployer as the initial relayer.
     */
    constructor (address _relayer) internal {
        require(_relayer != address(0), "Relayable: new relayer is the zero address");
        relayer = _relayer;
        emit RelayerTransferred(address(0), _relayer);
    }

    /**
     * @dev Returns the address of the current relayer.
     */
    function getRelayer() public view returns (address) {
        return relayer;
    }

    /**
     * @dev Throws if called by any transaction origin other than the relayer.
     */
    modifier onlyRelayer() {
        // solhint-disable-next-line avoid-tx-origin
        require(tx.origin == getRelayer(), "Relayable: caller is not the relayer");
        _;
    }

    /**
     * @dev Transfers relayer of the contract to a new account (`newRelayer`).
     * Can only be called by the current relayer.
     */
    function transferRelayer(address newRelayer) public onlyOwner {
        require(newRelayer != address(0), "Relayable: new relayer is the zero address");
        emit RelayerTransferred(relayer, newRelayer);
        relayer = newRelayer;
    }

}