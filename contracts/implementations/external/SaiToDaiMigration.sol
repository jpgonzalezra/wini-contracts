pragma solidity 0.5.10;

import "./../../Wallet.sol";
import "./../../interfaces/ScdMcdMigration.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract SaiToDaiMigration is Ownable, ReentrancyGuard {
     
    IERC20 public sai;
    ScdMcdMigration public migration;

    address public relayer;
    
    event NewRelayer(address _oldRelayer, address _newRelayer);
    event Swap(address indexed _sender, uint256 _wad);

    constructor (address _saiAddress, address _migrationAddress, address _relayer) public {
        require(_relayer != address(0));
        relayer = _relayer;
        sai = IERC20(_saiAddress);
        migration = ScdMcdMigration(_migrationAddress);
        sai.approve(_migrationAddress, uint256(-1));
    }
    
    function swapSaiToDai(
        uint256 _wad, 
        uint256 _fee, 
        bytes calldata _signature
    ) external nonReentrant {
        // solhint-disable-next-line avoid-tx-origin
        require(tx.origin == relayer, "Invalid transaction origin");
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _wad,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "Invalid signature");
        
        require(sai.transferFrom(msg.sender, relayer, _fee), "The transferFrom method failed (relayer)");
        require(sai.transferFrom(msg.sender, address(this), _wad), "The transferFrom method failed (this)");
        
        migration.swapSaiToDai(_wad);
        
        emit Swap(msg.sender, _wad);
    }
    
    function setRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0));
        emit NewRelayer(relayer, _newRelayer);
        relayer = _newRelayer;
    }
     
}