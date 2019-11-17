pragma solidity 0.5.10;


contract ICErc20 {
    address public underlying;
    function mint(uint mintAmount) external returns (uint);
    function isCToken() external returns (bool);
    function balanceOf(address account) external view returns (uint);
    function transfer(address, uint) external returns (bool);
    function transferFrom(address src, address dst, uint256 amount) external returns (bool success);
    function redeem(uint amount) external returns (uint);
}