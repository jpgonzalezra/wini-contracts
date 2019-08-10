pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/Math.sol";

/// @title WalletExecutor
contract WalletExecutor {
    uint256 private constant EXTRA_GAS = 21000;

    event IntentExecuted(
        bytes32 indexed _id,
        bool _success,
        bytes _result
    );

    /// @notice Performs calls when used as an implementation of a Wallet wallet
    ///         It validates dependencies, gas price/limit and expiration time
    /// @dev msg.data = 256 bits ID + N bits raw data
    function() external payable {
        _fallback();
    }

    function _fallback() internal {
        // Retrieve Intent ID and raw data
        (
            bytes32 id,
            bytes memory data
        ) = abi.decode(
            msg.data, (
                bytes32,
                bytes
            )
        );

        // Retrieve inputs from data
        bytes memory dependency;
        address to;
        uint256 value;
        uint256 maxGasLimit;
        uint256 maxGasPrice;
        uint256 expiration;

        (
            dependency,
            to,
            value,
            data,
            maxGasLimit,
            maxGasPrice,
            expiration
        ) = abi.decode(
            data, (
                bytes,
                address,
                uint256,
                bytes,
                uint256,
                uint256,
                uint256
            )
        );

        // Validate Intent not expired, gas price and dependencies
        // solhint-disable-next-line not-rely-on-time
        require(now < expiration, "Intent is expired");
        require(tx.gasprice < maxGasPrice, "Gas price too high");
        require(_checkDependency(dependency), "Dependency is not satisfied");

        // Perform the Intent call
        // Send max gas limit or maximum possible gas limit
        // (keep an extra to catch an out of gas)
        (
            bool success,
            bytes memory result
        ) = to.call.gas(
            Math.min(
                block.gaslimit - EXTRA_GAS,
                maxGasLimit
            )
        ).value(value)(data);

        // Emit receipt with result of the call
        emit IntentExecuted(
            id,
            success,
            result
        );
    }

    /// @notice The dependency is a 'staticcall' to a 'target'
    ///         when the call succeeds and it does not return false, the dependency is satisfied.
    /// @dev [160 bits (target) + n bits (data)]
    function _checkDependency(bytes memory _dependency) internal view returns (bool) {
        if (_dependency.length == 0) {
            return true;
        } 

        bool result;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let response := mload(0x40)
            let success := staticcall(
                gas,
                mload(add(_dependency, 20)),
                add(52, _dependency),
                sub(mload(_dependency), 20),
                response,
                32
            )

            result := and(gt(success, 0), gt(mload(response), 0))
        }

        return result;
        
    }
}
