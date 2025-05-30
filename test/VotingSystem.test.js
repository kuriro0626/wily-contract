const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingSystem", function () {
  let AuctionNFT;
  let VotingSystem;
  let nftContract;
  let votingContract;
  let owner;
  let addr1;
  let addr2;
  let treasuryAddress;
  let specialMintAddresses;
  let votingPeriod;
  let minProposalPeriod;
  let maxProposalPeriod;

  beforeEach(async function () {
    // コントラクトとアカウントの設定
    [owner, addr1, addr2, treasuryAddress, ...addrs] = await ethers.getSigners();
    specialMintAddresses = [addrs[0].address, addrs[1].address, addrs[2].address];
    votingPeriod = 7 * 24 * 60 * 60; // 7日間（秒）
    minProposalPeriod = 1 * 24 * 60 * 60; // 1日間（秒）
    maxProposalPeriod = 30 * 24 * 60 * 60; // 30日間（秒）

    // NFTコントラクトのデプロイ
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

    // 投票システムコントラクトのデプロイ
    VotingSystem = await ethers.getContractFactory("VotingSystem");
    votingContract = await VotingSystem.deploy(
      nftContract.address,
      votingPeriod,
      minProposalPeriod,
      maxProposalPeriod
    );
    await votingContract.deployed();

    // テスト用にNFTをmint
    await nftContract.mintNFT(addr1.address, Math.floor(Date.now() / 1000) + 86400);
  });

  describe("デプロイメント", function () {
    it("NFTコントラクトが正しく設定されるべき", async function () {
      expect(await votingContract.nftContract()).to.equal(nftContract.address);
    });

    it("投票期間が正しく設定されるべき", async function () {
      expect(await votingContract.votingPeriod()).to.equal(votingPeriod);
    });

    it("最小提案期間が正しく設定されるべき", async function () {
      expect(await votingContract.minProposalPeriod()).to.equal(minProposalPeriod);
    });

    it("最大提案期間が正しく設定されるべき", async function () {
      expect(await votingContract.maxProposalPeriod()).to.equal(maxProposalPeriod);
    });
  });

  describe("提案の作成", function () {
    it("NFTホルダーのみが提案を作成できるべき", async function () {
      // NFTホルダーが提案を作成
      await votingContract.connect(addr1).createProposal(
        "テスト提案",
        "これはテスト提案です",
        minProposalPeriod
      );
      
      // 提案の総数が1であることを確認
      expect(await votingContract.getProposalCount()).to.equal(1);
      
      // NFTを持っていないアドレスからの提案作成は失敗するべき
      await expect(
        votingContract.connect(addr2).createProposal(
          "テスト提案2",
          "これはテスト提案2です",
          minProposalPeriod
        )
      ).to.be.revertedWith("VotingSystem: NFTホルダーのみが提案を作成できます");
    });

    it("提案期間が制限内であるべき", async function () {
      // 最小提案期間未満の提案は失敗するべき
      await expect(
        votingContract.connect(addr1).createProposal(
          "短すぎる提案",
          "提案期間が短すぎます",
          minProposalPeriod - 1
        )
      ).to.be.revertedWith("VotingSystem: 提案期間が制限外です");
      
      // 最大提案期間を超える提案は失敗するべき
      await expect(
        votingContract.connect(addr1).createProposal(
          "長すぎる提案",
          "提案期間が長すぎます",
          maxProposalPeriod + 1
        )
      ).to.be.revertedWith("VotingSystem: 提案期間が制限外です");
    });

    it("提案情報が正しく設定されるべき", async function () {
      const title = "テスト提案";
      const description = "これはテスト提案です";
      
      await votingContract.connect(addr1).createProposal(
        title,
        description,
        minProposalPeriod
      );
      
      const proposal = await votingContract.getProposalDetails(1);
      
      expect(proposal.id).to.equal(1);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(proposal.proposer).to.equal(addr1.address);
      expect(proposal.executed).to.be.false;
      expect(proposal.forVotes).to.equal(0);
      expect(proposal.againstVotes).to.equal(0);
    });
  });

  describe("投票", function () {
    beforeEach(async function () {
      // 提案を作成
      await votingContract.connect(addr1).createProposal(
        "テスト提案",
        "これはテスト提案です",
        minProposalPeriod
      );
      
      // addr2にもNFTをmint
      await nftContract.mintNFT(addr2.address, Math.floor(Date.now() / 1000) + 86400);
    });

    it("NFTホルダーのみが投票できるべき", async function () {
      // NFTホルダーが投票
      await votingContract.connect(addr1).castVote(1, true);
      
      // 投票情報を確認
      const [hasVoted, support] = await votingContract.getVoteInfo(1, addr1.address);
      expect(hasVoted).to.be.true;
      expect(support).to.be.true;
      
      // NFTを持っていないアドレスからの投票は失敗するべき
      await expect(
        votingContract.connect(addrs[3]).castVote(1, true)
      ).to.be.revertedWith("VotingSystem: NFTホルダーのみが投票できます");
    });

    it("存在しない提案には投票できないべき", async function () {
      await expect(
        votingContract.connect(addr1).castVote(999, true)
      ).to.be.revertedWith("VotingSystem: 存在しない提案です");
    });

    it("投票期間が終了した後は投票できないべき", async function () {
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 投票を試みる
      await expect(
        votingContract.connect(addr1).castVote(1, true)
      ).to.be.revertedWith("VotingSystem: 投票期間が終了しています");
    });

    it("同じアドレスは一度しか投票できないべき", async function () {
      // 1回目の投票
      await votingContract.connect(addr1).castVote(1, true);
      
      // 2回目の投票は失敗するべき
      await expect(
        votingContract.connect(addr1).castVote(1, false)
      ).to.be.revertedWith("VotingSystem: 既に投票しています");
    });

    it("投票が正しくカウントされるべき", async function () {
      // 賛成票
      await votingContract.connect(addr1).castVote(1, true);
      
      // 反対票
      await votingContract.connect(addr2).castVote(1, false);
      
      // 投票結果を確認
      const proposal = await votingContract.getProposalDetails(1);
      expect(proposal.forVotes).to.equal(1);
      expect(proposal.againstVotes).to.equal(1);
    });
  });

  describe("提案の実行", function () {
    beforeEach(async function () {
      // 提案を作成
      await votingContract.connect(addr1).createProposal(
        "テスト提案",
        "これはテスト提案です",
        minProposalPeriod
      );
      
      // addr2にもNFTをmint
      await nftContract.mintNFT(addr2.address, Math.floor(Date.now() / 1000) + 86400);
      
      // 投票
      await votingContract.connect(addr1).castVote(1, true);
      await votingContract.connect(addr2).castVote(1, false);
    });

    it("投票期間が終了する前は提案を実行できないべき", async function () {
      await expect(
        votingContract.executeProposal(1)
      ).to.be.revertedWith("VotingSystem: 投票期間がまだ終了していません");
    });

    it("投票期間が終了した後は提案を実行できるべき", async function () {
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 提案を実行
      await votingContract.executeProposal(1);
      
      // 提案が実行済みになったことを確認
      const proposal = await votingContract.getProposalDetails(1);
      expect(proposal.executed).to.be.true;
    });

    it("提案は一度しか実行できないべき", async function () {
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 1回目の実行
      await votingContract.executeProposal(1);
      
      // 2回目の実行は失敗するべき
      await expect(
        votingContract.executeProposal(1)
      ).to.be.revertedWith("VotingSystem: 提案は既に実行されています");
    });

    it("提案の可決/否決が正しく判定されるべき", async function () {
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 提案を実行
      await votingContract.executeProposal(1);
      
      // 提案が可決されたかどうかを確認（賛成票と反対票が同数の場合は否決）
      expect(await votingContract.isProposalPassed(1)).to.be.false;
      
      // 新しい提案を作成
      await votingContract.connect(addr1).createProposal(
        "テスト提案2",
        "これはテスト提案2です",
        minProposalPeriod
      );
      
      // 賛成票のみ
      await votingContract.connect(addr1).castVote(2, true);
      await votingContract.connect(addr2).castVote(2, true);
      
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 提案を実行
      await votingContract.executeProposal(2);
      
      // 提案が可決されたことを確認
      expect(await votingContract.isProposalPassed(2)).to.be.true;
    });
  });

  describe("ユーティリティ関数", function () {
    beforeEach(async function () {
      // 提案を作成
      await votingContract.connect(addr1).createProposal(
        "テスト提案",
        "これはテスト提案です",
        minProposalPeriod
      );
    });

    it("残り時間が正しく計算されるべき", async function () {
      // 初期の残り時間を確認
      const initialRemainingTime = await votingContract.getRemainingTime(1);
      expect(initialRemainingTime).to.be.closeTo(ethers.BigNumber.from(minProposalPeriod), 5); // 誤差を許容
      
      // 時間を進める
      const timeToAdvance = 3600; // 1時間
      await time.increase(timeToAdvance);
      
      // 残り時間が減ったことを確認
      const newRemainingTime = await votingContract.getRemainingTime(1);
      expect(newRemainingTime).to.be.closeTo(initialRemainingTime.sub(timeToAdvance), 5); // 誤差を許容
    });

    it("提案が有効かどうかを正しく判定できるべき", async function () {
      // 初期状態では提案は有効
      expect(await votingContract.isProposalActive(1)).to.be.true;
      
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 投票期間が終了したら提案は無効
      expect(await votingContract.isProposalActive(1)).to.be.false;
      
      // 提案を実行
      await votingContract.executeProposal(1);
      
      // 実行済みの提案は無効
      expect(await votingContract.isProposalActive(1)).to.be.false;
    });

    it("提案が終了したかどうかを正しく判定できるべき", async function () {
      // 初期状態では提案は終了していない
      expect(await votingContract.isProposalEnded(1)).to.be.false;
      
      // 時間を進める
      await time.increase(minProposalPeriod + 1);
      
      // 投票期間が終了したら提案は終了
      expect(await votingContract.isProposalEnded(1)).to.be.true;
      
      // 新しい提案を作成
      await votingContract.connect(addr1).createProposal(
        "テスト提案2",
        "これはテスト提案2です",
        minProposalPeriod
      );
      
      // 提案を実行
      await votingContract.executeProposal(1);
      
      // 実行済みの提案は終了
      expect(await votingContract.isProposalEnded(1)).to.be.true;
    });

    it("投票の重みが正しく計算されるべき", async function () {
      // addr1は1つのNFTを持っている
      expect(await votingContract.getVotingWeight(addr1.address)).to.equal(1);
      
      // addr2はNFTを持っていない
      expect(await votingContract.getVotingWeight(addr2.address)).to.equal(0);
      
      // addr1にさらにNFTをmint
      await nftContract.mintNFT(addr1.address, Math.floor(Date.now() / 1000) + 86400);
      
      // addr1は2つのNFTを持っている
      expect(await votingContract.getVotingWeight(addr1.address)).to.equal(2);
    });
  });

  describe("管理機能", function () {
    it("オーナーのみが投票期間を設定できるべき", async function () {
      const newVotingPeriod = 14 * 24 * 60 * 60; // 14日間
      
      // オーナーが投票期間を設定
      await votingContract.setVotingPeriod(newVotingPeriod);
      expect(await votingContract.votingPeriod()).to.equal(newVotingPeriod);
      
      // 他のアドレスからの設定は失敗するべき
      await expect(
        votingContract.connect(addr1).setVotingPeriod(newVotingPeriod)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("オーナーのみが提案期間の制限を設定できるべき", async function () {
      const newMinPeriod = 2 * 24 * 60 * 60; // 2日間
      const newMaxPeriod = 60 * 24 * 60 * 60; // 60日間
      
      // オーナーが提案期間の制限を設定
      await votingContract.setProposalPeriodLimits(newMinPeriod, newMaxPeriod);
      expect(await votingContract.minProposalPeriod()).to.equal(newMinPeriod);
      expect(await votingContract.maxProposalPeriod()).to.equal(newMaxPeriod);
      
      // 他のアドレスからの設定は失敗するべき
      await expect(
        votingContract.connect(addr1).setProposalPeriodLimits(newMinPeriod, newMaxPeriod)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("最小提案期間は0より大きい必要があるべき", async function () {
      await expect(
        votingContract.setProposalPeriodLimits(0, maxProposalPeriod)
      ).to.be.revertedWith("VotingSystem: 最小提案期間は0より大きい必要があります");
    });

    it("最大提案期間は最小提案期間以上である必要があるべき", async function () {
      const newMinPeriod = 2 * 24 * 60 * 60; // 2日間
      
      await expect(
        votingContract.setProposalPeriodLimits(newMinPeriod, newMinPeriod - 1)
      ).to.be.revertedWith("VotingSystem: 最大提案期間は最小提案期間以上である必要があります");
    });
  });
});
