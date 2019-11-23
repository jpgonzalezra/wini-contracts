pragma solidity ^0.5.0;

/// @title Proxy
/// @dev Implements delegation of calls to other contracts, with proper
/// forwarding of return values and bubbling of failures.
/// It defines a fallback function that delegates all calls to the address
/// returned by implementation address
/// Based on https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/Proxy.sol
contract Proxy {

  address private implementation;

  constructor (address _implementation) public {
    implementation = _implementation;
  }

  /// @dev Fallback function.
  /// Implemented entirely in `_fallback`.
  function () payable external {
    _fallback();
  }

  /// @dev Delegates execution to an implementation contract.
  /// This is a low level function that doesn't return to its internal call site.
  /// It will return to the external caller whatever the implementation returns.
  /// @param _implementation Address to delegate.
  function _delegate(address _implementation) internal {
    assembly {
      // Copy msg.data. We take full control of memory in this inline assembly
      // block because it will not return to Solidity code. We overwrite the
      // Solidity scratch pad at memory position 0.
      calldatacopy(0, 0, calldatasize)

      // Call the implementation.
      // out and outsize are 0 because we don't know the size yet.
      let result := delegatecall(gas, _implementation, 0, calldatasize, 0, 0)

      // Copy the returned data.
      returndatacopy(0, 0, returndatasize)

      switch result
      // delegatecall returns 0 on error.
      case 0 { revert(0, returndatasize) }
      default { return(0, returndatasize) }
    }
  }

  /// @dev fallback implementation.
  /// Extracted to enable manual triggering.
  function _fallback() internal {
    _delegate(implementation);
  }

}
