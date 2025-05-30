const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction", function () {
  let AuctionNFT;
  let Auction;
  let nftContract;
  let auctionContract;
  let owner;
  let addr1;
  let addr2;
  let treasuryAddress;
  let specialMintAddresses;
  let auctionDuration;
  let minBidIncrementPercentage;
  let minBidPrice;

  beforeEach(async function () {
    // コントラクトとアカウントの設定
    [owner, addr1, addr2, treasuryAddress, ...addrs] = await ethers.getSigners();
    specialMintAddresses = [addrs[0].address, addrs[1].address, addrs[2].address];
    auctionDuration = 24 * 60 * 60; // 24時間（秒）
    minBidIncrementPercentage = 5; // 5%
    minBidPrice = ethers.utils.parseEther("0.01"); // 0.01 ETH

    // NFTコントラクトのデプロイ
    AuctionNFT = await ethers.getContractFactory("AuctionNFT");
    nftContract = await AuctionNFT.deploy(
      "OnChain Auction NFT",
      "OANFT",
      treasuryAddress.address,
      specialMintAddresses
    );
    await nftContract.deployed();

    // オークションコントラクトのデプロイ
    Auction = await ethers.getContractFactory("Auction");
    auctionContract = await Auction.deploy(
      nftContract.address,
      treasuryAddress.address,
      auctionDuration,
      minBidIncrementPercentage,
      minBidPrice
    );
    await auctionContract.deployed();

    // NFTコントラクトにオークションコントラクトのアドレスを設定
    await nftContract.setAuctionContract(auctionContract.address);
  });

  describe("デプロイメント", function () {
    it("NFTコントラクトが正しく設定されるべき", async function () {
      expect(await auctionContract.nftContract()).to.equal(nftContract.address);
    });

    it("トレジャリーアドレスが正しく設定されるべき", async function () {
      expect(await auctionContract.treasuryAddress()).to.equal(treasuryAddress.address);
    });

    it("オークション期間が正しく設定されるべき", async function () {
      expect(await auctionContract.auctionDuration()).to.equal(auctionDuration);
    });

    it("最小入札増加率が正しく設定されるべき", async function () {
      expect(await auctionContract.minBidIncrementPercentage()).to.equal(minBidIncrementPercentage);
    });

    it("最小入札価格が正しく設定されるべき", async function () {
      expect(await auctionContract.minBidPrice()).to.equal(minBidPrice);
    });
  });

  describe("オークションの作成", function () {
    it("オーナーのみがオークションを作成できるべき", async function () {
      // オーナーがオークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // アクティブなオークションIDが1であることを確認
      expect(await auctionContract.activeAuctionId()).to.equal(1);
      
      // 他のアドレスからのオークション作成は失敗するべき
      await expect(
        auctionContract.connect(addr1).createAuction(ethers.utils.parseEther("0.1"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("オークション情報が正しく設定されるべき", async function () {
      const startingPrice = ethers.utils.parseEther("0.1");
      await auctionContract.createAuction(startingPrice);
      
      const auction = await auctionContract.getAuction(1);
      expect(auction.tokenId).to.equal(1);
      expect(auction.startingPrice).to.equal(startingPrice);
      expect(auction.highestBid).to.equal(0);
      expect(auction.highestBidder).to.equal(ethers.constants.AddressZero);
      expect(auction.ended).to.be.false;
      expect(auction.claimed).to.be.false;
    });

    it("前のオークションが終了していない場合、新しいオークションを作成できないべき", async function () {
      // 1つ目のオークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // 2つ目のオークションを作成しようとすると失敗するべき
      await expect(
        auctionContract.createAuction(ethers.utils.parseEther("0.1"))
      ).to.be.revertedWith("Auction: 前のオークションがまだ終了していません");
    });
  });

  describe("入札", function () {
    beforeEach(async function () {
      // オークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
    });

    it("最小入札価格未満の入札は失敗するべき", async function () {
      await expect(
        auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.009") })
      ).to.be.revertedWith("Auction: 入札額が最小入札価格を下回っています");
    });

    it("開始価格未満の入札は失敗するべき", async function () {
      await expect(
        auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.05") })
      ).to.be.revertedWith("Auction: 入札額が開始価格を下回っています");
    });

    it("有効な入札は成功するべき", async function () {
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
      
      const auction = await auctionContract.getAuction(1);
      expect(auction.highestBid).to.equal(ethers.utils.parseEther("0.2"));
      expect(auction.highestBidder).to.equal(addr1.address);
    });

    it("最小入札増加率を満たさない入札は失敗するべき", async function () {
      // 最初の入札
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
      
      // 最小入札増加率を満たさない2つ目の入札
      await expect(
        auctionContract.connect(addr2).placeBid(1, { value: ethers.utils.parseEther("0.209") })
      ).to.be.revertedWith("Auction: 入札額が最小入札増加率を満たしていません");
    });

    it("前の最高入札者に返金されるべき", async function () {
      // addr1が入札
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
      
      // addr2がより高い金額で入札
      await auctionContract.connect(addr2).placeBid(1, { value: ethers.utils.parseEther("0.3") });
      
      // addr1の返金可能な金額を確認
      expect(await auctionContract.getPendingReturns(addr1.address)).to.equal(ethers.utils.parseEther("0.2"));
    });

    it("オークション期間が終了した後は入札できないべき", async function () {
      // 時間を進める
      await time.increase(auctionDuration + 1);
      
      // 入札を試みる
      await expect(
        auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") })
      ).to.be.revertedWith("Auction: オークション期間が終了しています");
    });
  });

  describe("オークションの終了", function () {
    beforeEach(async function () {
      // オークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // 入札
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
    });

    it("オークション期間が終了する前はオーナーのみがオークションを終了できるべき", async function () {
      // オーナーがオークションを終了
      await auctionContract.endAuction(1);
      
      const auction = await auctionContract.getAuction(1);
      expect(auction.ended).to.be.true;
      
      // 他のアドレスからのオークション終了は失敗するべき（期間終了前）
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      await expect(
        auctionContract.connect(addr1).endAuction(2)
      ).to.be.revertedWith("Auction: オークション期間が終了していないか、オーナーではありません");
    });

    it("オークション期間が終了した後は誰でもオークションを終了できるべき", async function () {
      // 時間を進める
      await time.increase(auctionDuration + 1);
      
      // addr1がオークションを終了
      await auctionContract.connect(addr1).endAuction(1);
      
      const auction = await auctionContract.getAuction(1);
      expect(auction.ended).to.be.true;
    });

    it("オークション収益がトレジャリーに送金されるべき", async function () {
      // トレジャリーの初期残高を取得
      const initialBalance = await ethers.provider.getBalance(treasuryAddress.address);
      
      // オークションを終了
      await auctionContract.endAuction(1);
      
      // トレジャリーの残高が増えたことを確認
      const finalBalance = await ethers.provider.getBalance(treasuryAddress.address);
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther("0.2"));
    });
  });

  describe("NFTの請求", function () {
    beforeEach(async function () {
      // オークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // 入札
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
      
      // オークションを終了
      await auctionContract.endAuction(1);
    });

    it("落札者のみがNFTを請求できるべき", async function () {
      // 落札者がNFTを請求
      await auctionContract.connect(addr1).claimNFT(1);
      
      // NFTの所有者が落札者になったことを確認
      expect(await nftContract.ownerOf(1)).to.equal(addr1.address);
      
      // 他のアドレスからのNFT請求は失敗するべき
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      await auctionContract.connect(addr2).placeBid(2, { value: ethers.utils.parseEther("0.2") });
      await auctionContract.endAuction(2);
      
      await expect(
        auctionContract.connect(addr1).claimNFT(2)
      ).to.be.revertedWith("Auction: 落札者のみがNFTを請求できます");
    });

    it("オークションが終了していない場合、NFTを請求できないべき", async function () {
      // 新しいオークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      await auctionContract.connect(addr1).placeBid(2, { value: ethers.utils.parseEther("0.2") });
      
      // オークションが終了していない状態でNFTを請求
      await expect(
        auctionContract.connect(addr1).claimNFT(2)
      ).to.be.revertedWith("Auction: オークションがまだ終了していません");
    });

    it("NFTは一度しか請求できないべき", async function () {
      // 1回目のNFT請求
      await auctionContract.connect(addr1).claimNFT(1);
      
      // 2回目のNFT請求は失敗するべき
      await expect(
        auctionContract.connect(addr1).claimNFT(1)
      ).to.be.revertedWith("Auction: NFTは既に請求されています");
    });
  });

  describe("資金の引き出し", function () {
    beforeEach(async function () {
      // オークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // addr1が入札
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
      
      // addr2がより高い金額で入札
      await auctionContract.connect(addr2).placeBid(1, { value: ethers.utils.parseEther("0.3") });
    });

    it("返金可能な資金を引き出せるべき", async function () {
      // addr1の初期残高を取得
      const initialBalance = await ethers.provider.getBalance(addr1.address);
      
      // 返金可能な金額を確認
      expect(await auctionContract.getPendingReturns(addr1.address)).to.equal(ethers.utils.parseEther("0.2"));
      
      // 資金を引き出す
      const tx = await auctionContract.connect(addr1).withdrawFunds();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // 残高が増えたことを確認（ガス代を考慮）
      const finalBalance = await ethers.provider.getBalance(addr1.address);
      expect(finalBalance.add(gasUsed).sub(initialBalance)).to.equal(ethers.utils.parseEther("0.2"));
      
      // 返金可能な金額が0になったことを確認
      expect(await auctionContract.getPendingReturns(addr1.address)).to.equal(0);
    });

    it("返金可能な資金がない場合、引き出しは失敗するべき", async function () {
      // 返金可能な資金がないアドレスからの引き出し
      await expect(
        auctionContract.connect(owner).withdrawFunds()
      ).to.be.revertedWith("Auction: 引き出し可能な資金がありません");
    });
  });

  describe("ユーティリティ関数", function () {
    beforeEach(async function () {
      // オークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
    });

    it("残り時間が正しく計算されるべき", async function () {
      // 初期の残り時間を確認
      const initialRemainingTime = await auctionContract.getRemainingTime(1);
      expect(initialRemainingTime).to.be.closeTo(ethers.BigNumber.from(auctionDuration), 5); // 誤差を許容
      
      // 時間を進める
      const timeToAdvance = 3600; // 1時間
      await time.increase(timeToAdvance);
      
      // 残り時間が減ったことを確認
      const newRemainingTime = await auctionContract.getRemainingTime(1);
      expect(newRemainingTime).to.be.closeTo(initialRemainingTime.sub(timeToAdvance), 5); // 誤差を許容
    });

    it("次の最小入札額が正しく計算されるべき", async function () {
      // 初期状態（入札なし）
      let nextMinBid = await auctionContract.getNextMinimumBid(1);
      expect(nextMinBid).to.equal(ethers.utils.parseEther("0.1")); // 開始価格
      
      // 入札後
      await auctionContract.connect(addr1).placeBid(1, { value: ethers.utils.parseEther("0.2") });
      nextMinBid = await auctionContract.getNextMinimumBid(1);
      
      // 0.2 ETH + 5% = 0.21 ETH
      expect(nextMinBid).to.equal(ethers.utils.parseEther("0.21"));
    });

    it("アクティブなオークション情報が取得できるべき", async function () {
      const activeAuction = await auctionContract.getActiveAuction();
      expect(activeAuction.tokenId).to.equal(1);
    });
  });

  describe("自動オークション作成", function () {
    it("前のオークションが終了していれば新しいオークションを作成できるべき", async function () {
      // 1つ目のオークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // オークションを終了
      await auctionContract.endAuction(1);
      
      // 新しいオークションを作成
      await auctionContract.createNextAuction(ethers.utils.parseEther("0.1"));
      
      // アクティブなオークションIDが2であることを確認
      expect(await auctionContract.activeAuctionId()).to.equal(2);
    });

    it("前のオークションが期間終了していれば自動的に終了させて新しいオークションを作成できるべき", async function () {
      // 1つ目のオークションを作成
      await auctionContract.createAuction(ethers.utils.parseEther("0.1"));
      
      // 時間を進める
      await time.increase(auctionDuration + 1);
      
      // 新しいオークションを作成（前のオークションは自動的に終了する）
      await auctionContract.createNextAuction(ethers.utils.parseEther("0.1"));
      
      // 1つ目のオークションが終了していることを確認
      const auction1 = await auctionContract.getAuction(1);
      expect(auction1.ended).to.be.true;
      
      // アクティブなオークションIDが2であることを確認
      expect(await auctionContract.activeAuctionId()).to.equal(2);
    });
  });
});
