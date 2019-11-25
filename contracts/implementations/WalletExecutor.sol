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
        address to;
        uint256 value;
        uint256 maxGasLimit;
        uint256 maxGasPrice;
        (
            to,
            value,
            data,
            maxGasLimit,
            maxGasPrice
        ) = abi.decode(
            data, (
                address,
                uint256,
                bytes,
                uint256,
                uint256
            )
        );

        // Validate Intent.
        // solhint-disable-next-line not-rely-on-time
        require(tx.gasprice < maxGasPrice, "Gas price too high");

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

        // Emit receipt with call result.
        emit IntentExecuted(
            id,
            success,
            result
        );
    }

}
