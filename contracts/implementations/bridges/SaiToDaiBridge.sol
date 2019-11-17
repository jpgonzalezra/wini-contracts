pragma solidity 0.5.10;

import "./../../Wallet.sol";
import "./../../interfaces/ScdMcdMigration.sol";
import "./../../common/Relayable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract SaiToDaiBridge is Relayable, ReentrancyGuard {
     
    IERC20 public sai;
    ScdMcdMigration public migration;
    
    event Swap(address indexed _sender, uint256 _wad);

    constructor (
        address _saiAddress,
        address _migrationAddress,
        address _relayer
    ) Relayable(_relayer) public {
        sai = IERC20(_saiAddress);
        migration = ScdMcdMigration(_migrationAddress);
        sai.approve(_migrationAddress, uint256(-1));
    }
    
    function swapSaiToDai(
        uint256 _wad, 
        uint256 _fee, 
        bytes calldata _signature
    ) external nonReentrant onlyRelayer {
        Wallet wallet = Wallet(msg.sender);
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                _wad,
                _fee
            )
        );
        require(wallet.signer() == ECDSA.recover(hash, _signature), "Invalid signature");
        
        require(sai.transferFrom(msg.sender, getRelayer(), _fee), "The transferFrom method failed (relayer)");
        require(sai.transferFrom(msg.sender, address(this), _wad), "The transferFrom method failed (this)");
        
        migration.swapSaiToDai(_wad);
        
        emit Swap(msg.sender, _wad);
    }
     
}