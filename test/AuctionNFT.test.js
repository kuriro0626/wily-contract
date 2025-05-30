const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AuctionNFT", function () {
  let AuctionNFT;
  let nftContract;
  let owner;
  let addr1;
  let addr2;
  let treasuryAddress;
  let specialMintAddresses;

  beforeEach(async function () {
    // コントラクトとアカウントの設定
    [owner, addr1, addr2, treasuryAddress, ...addrs] = await ethers.getSigners();
    specialMintAddresses = [addrs[0].address, addrs[1].address, addrs[2].address];

    AuctionNFT = await ethers.getContractFactory("AuctionNFT");
    nftContract = await AuctionNFT.deploy(
      "OnChain Auction NFT",
      "OANFT",
      treasuryAddress.address,
      specialMintAddresses
    );
    await nftContract.deployed();

    // オークションコントラクトの役割を果たすためにオーナーアドレスを設定
    await nftContract.setAuctionContract(owner.address);
  });

  describe("デプロイメント", function () {
    it("正しい名前とシンボルが設定されるべき", async function () {
      expect(await nftContract.name()).to.equal("OnChain Auction NFT");
      expect(await nftContract.symbol()).to.equal("OANFT");
    });

    it("トレジャリーアドレスが正しく設定されるべき", async function () {
      expect(await nftContract.treasuryAddress()).to.equal(treasuryAddress.address);
    });

    it("特別なmintアドレスが正しく設定されるべき", async function () {
      expect(await nftContract.getSpecialMintAddressesCount()).to.equal(specialMintAddresses.length);
      
      for (let i = 0; i < specialMintAddresses.length; i++) {
        expect(await nftContract.specialMintAddresses(i)).to.equal(specialMintAddresses[i]);
      }
    });
  });

  describe("NFTのmint", function () {
    it("オークションコントラクトのみがNFTをmintできるべき", async function () {
      // オークションコントラクトとして設定されたオーナーがmint
      await nftContract.mintNFT(addr1.address, Math.floor(Date.now() / 1000) + 86400);
      expect(await nftContract.balanceOf(addr1.address)).to.equal(1);
      expect(await nftContract.ownerOf(1)).to.equal(addr1.address);

      // 他のアドレスからのmintは失敗するべき
      await expect(
        nftContract.connect(addr1).mintNFT(addr2.address, Math.floor(Date.now() / 1000) + 86400)
      ).to.be.revertedWith("AuctionNFT: 呼び出し元はオークションコントラクトである必要があります");
    });

    it("1日に1つのNFTしかmintできないべき", async function () {
      // 1つ目のNFTをmint
      await nftContract.mintNFT(addr1.address, Math.floor(Date.now() / 1000) + 86400);
      
      // 同じ日に2つ目のNFTをmintしようとすると失敗するべき
      await expect(
        nftContract.mintNFT(addr2.address, Math.floor(Date.now() / 1000) + 86400)
      ).to.be.revertedWith("AuctionNFT: 1日に1つのNFTしかmintできません");
    });

    it("トークンURIが正しく生成されるべき", async function () {
      // NFTをmint
      await nftContract.mintNFT(addr1.address, Math.floor(Date.now() / 1000) + 86400);
      
      // トークンURIを取得
      const tokenURI = await nftContract.tokenURI(1);
      
      // トークンURIがdata:application/json;base64で始まることを確認
      expect(tokenURI).to.match(/^data:application\/json;base64,/);
      
      // Base64デコード
      const base64Data = tokenURI.replace("data:application/json;base64,", "");
      const jsonData = Buffer.from(base64Data, "base64").toString("utf-8");
      const metadata = JSON.parse(jsonData);
      
      // メタデータの検証
      expect(metadata.name).to.equal("Auction NFT #1");
      expect(metadata.description).to.equal("フルオンチェーンNFTオークションで作成されたNFT");
      expect(metadata.image).to.match(/^data:image\/svg\+xml;base64,/);
      expect(metadata.attributes).to.be.an("array");
    });
  });

  describe("オークション結果の更新", function () {
    beforeEach(async function () {
      // NFTをmint
      await nftContract.mintNFT(addr1.address, Math.floor(Date.now() / 1000) + 86400);
    });

    it("オークションコントラクトのみがオークション結果を更新できるべき", async function () {
      // オークションコントラクトとして設定されたオーナーが結果を更新
      await nftContract.updateAuctionResult(1, ethers.utils.parseEther("1.0"), addr2.address);
      
      // 他のアドレスからの更新は失敗するべき
      await expect(
        nftContract.connect(addr1).updateAuctionResult(1, ethers.utils.parseEther("2.0"), addr1.address)
      ).to.be.revertedWith("AuctionNFT: 呼び出し元はオークションコントラクトである必要があります");
    });

    it("存在しないトークンIDのオークション結果は更新できないべき", async function () {
      await expect(
        nftContract.updateAuctionResult(999, ethers.utils.parseEther("1.0"), addr2.address)
      ).to.be.revertedWith("AuctionNFT: 存在しないトークンIDです");
    });
  });

  describe("管理機能", function () {
    it("オーナーのみがオークションコントラクトアドレスを設定できるべき", async function () {
      await nftContract.setAuctionContract(addr1.address);
      expect(await nftContract.auctionContract()).to.equal(addr1.address);
      
      await expect(
        nftContract.connect(addr1).setAuctionContract(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("オーナーのみがトレジャリーアドレスを設定できるべき", async function () {
      await nftContract.setTreasuryAddress(addr1.address);
      expect(await nftContract.treasuryAddress()).to.equal(addr1.address);
      
      await expect(
        nftContract.connect(addr1).setTreasuryAddress(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("オーナーのみが特別なmintアドレスを設定できるべき", async function () {
      const newAddresses = [addr1.address, addr2.address];
      await nftContract.setSpecialMintAddresses(newAddresses);
      
      expect(await nftContract.getSpecialMintAddressesCount()).to.equal(newAddresses.length);
      expect(await nftContract.specialMintAddresses(0)).to.equal(newAddresses[0]);
      expect(await nftContract.specialMintAddresses(1)).to.equal(newAddresses[1]);
      
      await expect(
        nftContract.connect(addr1).setSpecialMintAddresses(newAddresses)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("オーナーのみが資金を引き出せるべき", async function () {
      // コントラクトに資金を送金
      await owner.sendTransaction({
        to: nftContract.address,
        value: ethers.utils.parseEther("1.0")
      });
      
      // トレジャリーの初期残高を取得
      const initialBalance = await ethers.provider.getBalance(treasuryAddress.address);
      
      // 資金を引き出す
      await nftContract.withdrawFunds();
      
      // トレジャリーの残高が増えたことを確認
      const finalBalance = await ethers.provider.getBalance(treasuryAddress.address);
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther("1.0"));
      
      // 他のアドレスからの引き出しは失敗するべき
      await expect(
        nftContract.connect(addr1).withdrawFunds()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
