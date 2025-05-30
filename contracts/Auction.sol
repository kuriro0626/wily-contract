// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./AuctionNFT.sol";

/**
 * @title Auction
 * @dev フルオンチェーンNFTオークションのためのオークションコントラクト
 * 毎日1つのNFTが自動的にmintされ、オークションにかけられる
 * オークション収益はトレジャリーに蓄積される
 */
contract Auction is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // オークション情報
    struct AuctionInfo {
        uint256 tokenId;
        uint256 startTime;
        uint256 endTime;
        uint256 startingPrice;
        uint256 highestBid;
        address highestBidder;
        bool ended;
        bool claimed;
    }
    
    // NFTコントラクト
    AuctionNFT public nftContract;
    
    // トレジャリーのアドレス
    address public treasuryAddress;
    
    // オークションID
    Counters.Counter private _auctionIdCounter;
    
    // オークションIDごとのオークション情報
    mapping(uint256 => AuctionInfo) public auctions;
    
    // 現在アクティブなオークションID
    uint256 public activeAuctionId;
    
    // 入札者ごとの返金可能な金額
    mapping(address => uint256) public pendingReturns;
    
    // オークション期間（秒）
    uint256 public auctionDuration;
    
    // 最小入札増加率（パーセント）
    uint256 public minBidIncrementPercentage;
    
    // 最小入札価格
    uint256 public minBidPrice;
    
    // イベント
    event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, uint256 startTime, uint256 endTime, uint256 startingPrice);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 amount);
    event NFTClaimed(uint256 indexed auctionId, uint256 indexed tokenId, address indexed claimer);
    event FundsWithdrawn(address indexed bidder, uint256 amount);
    event TreasuryAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event AuctionDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event MinBidIncrementPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event MinBidPriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    /**
     * @dev コンストラクタ
     * @param _nftContract NFTコントラクトのアドレス
     * @param _treasuryAddress トレジャリーのアドレス
     * @param _auctionDuration オークション期間（秒）
     * @param _minBidIncrementPercentage 最小入札増加率（パーセント）
     * @param _minBidPrice 最小入札価格（wei）
     */
    constructor(
        address _nftContract,
        address _treasuryAddress,
        uint256 _auctionDuration,
        uint256 _minBidIncrementPercentage,
        uint256 _minBidPrice
    ) {
        require(_nftContract != address(0), "Auction: NFTコントラクトは0アドレスにできません");
        require(_treasuryAddress != address(0), "Auction: トレジャリーアドレスは0アドレスにできません");
        require(_auctionDuration > 0, "Auction: オークション期間は0より大きい必要があります");
        require(_minBidIncrementPercentage > 0, "Auction: 最小入札増加率は0より大きい必要があります");
        
        nftContract = AuctionNFT(_nftContract);
        treasuryAddress = _treasuryAddress;
        auctionDuration = _auctionDuration;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        minBidPrice = _minBidPrice;
    }
    
    /**
     * @dev トレジャリーのアドレスを設定
     * @param _treasuryAddress トレジャリーのアドレス
     */
    function setTreasuryAddress(address _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Auction: トレジャリーアドレスは0アドレスにできません");
        address oldTreasuryAddress = treasuryAddress;
        treasuryAddress = _treasuryAddress;
        emit TreasuryAddressUpdated(oldTreasuryAddress, _treasuryAddress);
    }
    
    /**
     * @dev オークション期間を設定
     * @param _auctionDuration オークション期間（秒）
     */
    function setAuctionDuration(uint256 _auctionDuration) external onlyOwner {
        require(_auctionDuration > 0, "Auction: オークション期間は0より大きい必要があります");
        uint256 oldDuration = auctionDuration;
        auctionDuration = _auctionDuration;
        emit AuctionDurationUpdated(oldDuration, _auctionDuration);
    }
    
    /**
     * @dev 最小入札増加率を設定
     * @param _minBidIncrementPercentage 最小入札増加率（パーセント）
     */
    function setMinBidIncrementPercentage(uint256 _minBidIncrementPercentage) external onlyOwner {
        require(_minBidIncrementPercentage > 0, "Auction: 最小入札増加率は0より大きい必要があります");
        uint256 oldPercentage = minBidIncrementPercentage;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        emit MinBidIncrementPercentageUpdated(oldPercentage, _minBidIncrementPercentage);
    }
    
    /**
     * @dev 最小入札価格を設定
     * @param _minBidPrice 最小入札価格（wei）
     */
    function setMinBidPrice(uint256 _minBidPrice) external onlyOwner {
        uint256 oldPrice = minBidPrice;
        minBidPrice = _minBidPrice;
        emit MinBidPriceUpdated(oldPrice, _minBidPrice);
    }
    
    /**
     * @dev 新しいオークションを作成する
     * @param _startingPrice 開始価格
     * @return auctionId オークションID
     */
    function createAuction(uint256 _startingPrice) external onlyOwner returns (uint256) {
        // 前のオークションが終了していることを確認
        if (activeAuctionId > 0) {
            AuctionInfo storage prevAuction = auctions[activeAuctionId];
            require(prevAuction.ended, "Auction: 前のオークションがまだ終了していません");
        }
        
        // オークション終了時間を計算
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + auctionDuration;
        
        // NFTをmint
        uint256 tokenId = nftContract.mintNFT(address(this), endTime);
        
        // オークションIDをインクリメント
        _auctionIdCounter.increment();
        uint256 auctionId = _auctionIdCounter.current();
        
        // オークション情報を設定
        auctions[auctionId] = AuctionInfo({
            tokenId: tokenId,
            startTime: startTime,
            endTime: endTime,
            startingPrice: _startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            ended: false,
            claimed: false
        });
        
        // アクティブなオークションIDを更新
        activeAuctionId = auctionId;
        
        emit AuctionCreated(auctionId, tokenId, startTime, endTime, _startingPrice);
        
        return auctionId;
    }
    
    /**
     * @dev オークションに入札する
     * @param auctionId オークションID
     */
    function placeBid(uint256 auctionId) external payable nonReentrant {
        AuctionInfo storage auction = auctions[auctionId];
        
        require(auction.tokenId > 0, "Auction: 存在しないオークションです");
        require(!auction.ended, "Auction: オークションは終了しています");
        require(block.timestamp < auction.endTime, "Auction: オークション期間が終了しています");
        
        uint256 bidAmount = msg.value;
        
        // 最小入札価格を確認
        require(bidAmount >= minBidPrice, "Auction: 入札額が最小入札価格を下回っています");
        
        // 最初の入札の場合
        if (auction.highestBidder == address(0)) {
            require(bidAmount >= auction.startingPrice, "Auction: 入札額が開始価格を下回っています");
        } else {
            // 最小入札増加率を確認
            uint256 minBidAmount = auction.highestBid + (auction.highestBid * minBidIncrementPercentage / 100);
            require(bidAmount >= minBidAmount, "Auction: 入札額が最小入札増加率を満たしていません");
            
            // 前の最高入札者に返金
            pendingReturns[auction.highestBidder] += auction.highestBid;
        }
        
        // 新しい最高入札を設定
        auction.highestBid = bidAmount;
        auction.highestBidder = msg.sender;
        
        emit BidPlaced(auctionId, msg.sender, bidAmount);
    }
    
    /**
     * @dev オークションを終了する
     * @param auctionId オークションID
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        AuctionInfo storage auction = auctions[auctionId];
        
        require(auction.tokenId > 0, "Auction: 存在しないオークションです");
        require(!auction.ended, "Auction: オークションは既に終了しています");
        require(
            block.timestamp >= auction.endTime || msg.sender == owner(),
            "Auction: オークション期間が終了していないか、オーナーではありません"
        );
        
        // オークションを終了
        auction.ended = true;
        
        // 落札者がいる場合
        if (auction.highestBidder != address(0)) {
            // オークション結果をNFTコントラクトに更新
            nftContract.updateAuctionResult(auction.tokenId, auction.highestBid, auction.highestBidder);
            
            // オークション収益をトレジャリーに送金
            (bool success, ) = treasuryAddress.call{value: auction.highestBid}("");
            require(success, "Auction: トレジャリーへの送金に失敗しました");
        }
        
        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }
    
    /**
     * @dev NFTを請求する
     * @param auctionId オークションID
     */
    function claimNFT(uint256 auctionId) external nonReentrant {
        AuctionInfo storage auction = auctions[auctionId];
        
        require(auction.tokenId > 0, "Auction: 存在しないオークションです");
        require(auction.ended, "Auction: オークションがまだ終了していません");
        require(!auction.claimed, "Auction: NFTは既に請求されています");
        require(auction.highestBidder == msg.sender, "Auction: 落札者のみがNFTを請求できます");
        
        // NFTを請求済みにマーク
        auction.claimed = true;
        
        // NFTを落札者に転送
        nftContract.safeTransferFrom(address(this), msg.sender, auction.tokenId);
        
        emit NFTClaimed(auctionId, auction.tokenId, msg.sender);
    }
    
    /**
     * @dev 返金を引き出す
     */
    function withdrawFunds() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Auction: 引き出し可能な資金がありません");
        
        // 再入攻撃を防ぐために、先に残高をリセット
        pendingReturns[msg.sender] = 0;
        
        // 資金を送金
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Auction: 資金の引き出しに失敗しました");
        
        emit FundsWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev 引き出し可能な資金を確認する
     * @param bidder 入札者のアドレス
     * @return 引き出し可能な資金
     */
    function getPendingReturns(address bidder) external view returns (uint256) {
        return pendingReturns[bidder];
    }
    
    /**
     * @dev オークション情報を取得する
     * @param auctionId オークションID
     * @return オークション情報
     */
    function getAuction(uint256 auctionId) external view returns (AuctionInfo memory) {
        return auctions[auctionId];
    }
    
    /**
     * @dev 現在アクティブなオークション情報を取得する
     * @return オークション情報
     */
    function getActiveAuction() external view returns (AuctionInfo memory) {
        return auctions[activeAuctionId];
    }
    
    /**
     * @dev オークションの残り時間を取得する
     * @param auctionId オークションID
     * @return 残り時間（秒）
     */
    function getRemainingTime(uint256 auctionId) external view returns (uint256) {
        AuctionInfo storage auction = auctions[auctionId];
        
        if (auction.ended || block.timestamp >= auction.endTime) {
            return 0;
        }
        
        return auction.endTime - block.timestamp;
    }
    
    /**
     * @dev 次の最小入札額を取得する
     * @param auctionId オークションID
     * @return 次の最小入札額
     */
    function getNextMinimumBid(uint256 auctionId) external view returns (uint256) {
        AuctionInfo storage auction = auctions[auctionId];
        
        if (auction.highestBidder == address(0)) {
            return auction.startingPrice > minBidPrice ? auction.startingPrice : minBidPrice;
        }
        
        uint256 minBidAmount = auction.highestBid + (auction.highestBid * minBidIncrementPercentage / 100);
        return minBidAmount > minBidPrice ? minBidAmount : minBidPrice;
    }
    
    /**
     * @dev 自動的に新しいオークションを作成する
     * @param _startingPrice 開始価格
     */
    function createNextAuction(uint256 _startingPrice) external {
        // 前のオークションが終了していることを確認
        if (activeAuctionId > 0) {
            AuctionInfo storage prevAuction = auctions[activeAuctionId];
            
            // 前のオークションが終了していない場合は、終了させる
            if (!prevAuction.ended && block.timestamp >= prevAuction.endTime) {
                this.endAuction(activeAuctionId);
            } else {
                require(prevAuction.ended, "Auction: 前のオークションがまだ終了していません");
            }
        }
        
        // 新しいオークションを作成
        this.createAuction(_startingPrice);
    }
    
    /**
     * @dev コントラクトがNFTを受け取れるようにする
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    /**
     * @dev コントラクトがETHを受け取れるようにする
     */
    receive() external payable {}
}
