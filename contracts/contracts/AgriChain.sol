// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgriChain is Ownable, ReentrancyGuard {
    uint256 public constant ADMIN_FEE_BPS = 200;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Crop {
        uint256 id;
        address farmer;
        uint256 pricePerUnit;
        uint256 quantity;
        uint256 expiry;
        bool isSold;
        address buyer;
        string offchainId;
    }

    uint256 public cropCount;
    mapping(uint256 => Crop) public crops;
    mapping(address => bool) public blacklisted;
    bool public paused;

    event CropListed(
        uint256 indexed cropId,
        address indexed farmer,
        uint256 pricePerUnit,
        uint256 quantity,
        uint256 expiry,
        string offchainId
    );
    event CropPurchased(uint256 indexed cropId, address indexed buyer, uint256 units, uint256 value);
    event AdminFeePaid(address indexed admin, address indexed farmer, uint256 feeAmount, uint256 grossAmount);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);
    event WalletBlacklisted(address indexed wallet, bool status);

    modifier notPaused() {
        require(!paused, "Marketplace paused");
        _;
    }

    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "Wallet blacklisted");
        _;
    }

    constructor(address admin) Ownable(admin) {}

    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit ContractUnpaused(msg.sender);
    }

    function setBlacklist(address wallet, bool status) external onlyOwner {
        blacklisted[wallet] = status;
        emit WalletBlacklisted(wallet, status);
    }

    function listCrop(
        address farmer,
        uint256 pricePerUnit,
        uint256 quantity,
        uint256 expiry,
        string calldata offchainId
    ) external onlyOwner notPaused notBlacklisted(farmer) {
        require(expiry > block.timestamp, "Expiry must be future");
        require(pricePerUnit > 0, "Price required");
        require(quantity > 0, "Quantity required");

        cropCount += 1;
        crops[cropCount] = Crop({
            id: cropCount,
            farmer: farmer,
            pricePerUnit: pricePerUnit,
            quantity: quantity,
            expiry: expiry,
            isSold: false,
            buyer: address(0),
            offchainId: offchainId
        });

        emit CropListed(cropCount, farmer, pricePerUnit, quantity, expiry, offchainId);
    }

    function purchaseCrop(uint256 cropId)
        external
        payable
        nonReentrant
        notPaused
        notBlacklisted(msg.sender)
    {
        Crop storage crop = crops[cropId];
        uint256 units = crop.quantity;
        _purchaseUnits(cropId, units);
    }

    function purchaseUnits(uint256 cropId, uint256 units)
        external
        payable
        nonReentrant
        notPaused
        notBlacklisted(msg.sender)
    {
        _purchaseUnits(cropId, units);
    }

    function purchaseBatch(uint256[] calldata cropIds, uint256[] calldata units)
        external
        payable
        nonReentrant
        notPaused
        notBlacklisted(msg.sender)
    {
        require(cropIds.length > 0, "Empty batch");
        require(cropIds.length == units.length, "Mismatched batch");

        address farmer = crops[cropIds[0]].farmer;
        require(farmer != address(0), "Crop not found");
        uint256 total = 0;

        for (uint256 i = 0; i < cropIds.length; i++) {
            Crop storage crop = crops[cropIds[i]];
            require(crop.id != 0, "Crop not found");
            require(crop.farmer == farmer, "Different farmer");
            total += _validatePurchase(crop, units[i]);
        }

        require(msg.value == total, "Incorrect payment");

        for (uint256 i = 0; i < cropIds.length; i++) {
            Crop storage crop = crops[cropIds[i]];
            uint256 lineTotal = crop.pricePerUnit * units[i];
            _applyPurchase(crop, units[i]);
            emit CropPurchased(cropIds[i], msg.sender, units[i], lineTotal);
        }

        _payoutWithAdminFee(farmer, total);
    }

    function _purchaseUnits(uint256 cropId, uint256 units) internal {
        Crop storage crop = crops[cropId];
        uint256 total = _validatePurchase(crop, units);
        require(msg.value == total, "Incorrect payment");

        _applyPurchase(crop, units);
        _payoutWithAdminFee(crop.farmer, total);

        emit CropPurchased(cropId, msg.sender, units, total);
    }

    function _validatePurchase(Crop storage crop, uint256 units) internal view returns (uint256) {
        require(crop.id != 0, "Crop not found");
        require(!crop.isSold, "Already sold");
        require(units > 0, "Units required");
        require(units <= crop.quantity, "Insufficient quantity");
        require(crop.expiry > block.timestamp, "Crop expired");
        require(!blacklisted[crop.farmer], "Farmer blacklisted");
        return crop.pricePerUnit * units;
    }

    function _applyPurchase(Crop storage crop, uint256 units) internal {
        crop.quantity -= units;
        if (crop.quantity == 0) {
            crop.isSold = true;
        }
        crop.buyer = msg.sender;
    }

    function _payoutWithAdminFee(address farmer, uint256 grossAmount) internal {
        uint256 feeAmount = (grossAmount * ADMIN_FEE_BPS) / BPS_DENOMINATOR;
        uint256 farmerAmount = grossAmount - feeAmount;
        address adminWallet = owner();

        (bool farmerSuccess, ) = farmer.call{ value: farmerAmount }("");
        require(farmerSuccess, "Farmer payment failed");

        if (feeAmount > 0) {
            (bool adminSuccess, ) = adminWallet.call{ value: feeAmount }("");
            require(adminSuccess, "Admin fee transfer failed");
        }

        emit AdminFeePaid(adminWallet, farmer, feeAmount, grossAmount);
    }
}
