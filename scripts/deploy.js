// デプロイスクリプト
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // アカウント情報を取得
  const [deployer] = await hre.ethers.getSigners();
  console.log("デプロイアドレス:", deployer.address);
  console.log("アカウント残高:", (await deployer.getBalance()).toString());

  // デプロイ設定を取得
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const specialMintAddresses = (process.env.SPECIAL_MINT_ADDRESSES || "").split(",").filter(addr => addr.trim() !== "");
  
  if (specialMintAddresses.length === 0) {
    // デフォルトのアドレスを追加（実際のデプロイ時には適切なアドレスに置き換える）
    specialMintAddresses.push(deployer.address);
  }

  console.log("トレジャリーアドレス:", treasuryAddress);
  console.log("特別なmintアドレス:", specialMintAddresses);

  // NFTコントラクトをデプロイ
  console.log("NFTコントラクトをデプロイ中...");
  const AuctionNFT = await hre.ethers.getContractFactory("AuctionNFT");
  const nftContract = await AuctionNFT.deploy(
    process.env.NFT_NAME || "OnChain Auction NFT",
    process.env.NFT_SYMBOL || "OANFT",
    treasuryAddress,
    specialMintAddresses
  );
  await nftContract.deployed();
  console.log("NFTコントラクトがデプロイされました:", nftContract.address);

  // オークションコントラクトをデプロイ
  console.log("オークションコントラクトをデプロイ中...");
  const auctionDuration = parseInt(process.env.AUCTION_DURATION_HOURS || "24") * 60 * 60; // 時間を秒に変換
  const minBidIncrementPercentage = parseInt(process.env.MIN_BID_INCREMENT_PERCENTAGE || "5");
  const minBidPrice = hre.ethers.utils.parseEther("0.01"); // 最小入札価格: 0.01 ETH

  const Auction = await hre.ethers.getContractFactory("Auction");
  const auctionContract = await Auction.deploy(
    nftContract.address,
    treasuryAddress,
    auctionDuration,
    minBidIncrementPercentage,
    minBidPrice
  );
  await auctionContract.deployed();
  console.log("オークションコントラクトがデプロイされました:", auctionContract.address);

  // NFTコントラクトにオークションコントラクトのアドレスを設定
  console.log("NFTコントラクトにオークションコントラクトのアドレスを設定中...");
  await nftContract.setAuctionContract(auctionContract.address);
  console.log("オークションコントラクトのアドレスが設定されました");

  // 投票コントラクトをデプロイ
  console.log("投票コントラクトをデプロイ中...");
  const votingPeriod = 7 * 24 * 60 * 60; // デフォルト投票期間: 7日
  const minProposalPeriod = 1 * 24 * 60 * 60; // 最小提案期間: 1日
  const maxProposalPeriod = 30 * 24 * 60 * 60; // 最大提案期間: 30日

  const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
  const votingContract = await VotingSystem.deploy(
    nftContract.address,
    votingPeriod,
    minProposalPeriod,
    maxProposalPeriod
  );
  await votingContract.deployed();
  console.log("投票コントラクトがデプロイされました:", votingContract.address);

  // フロントエンドHTMLを読み込む
  let htmlContent = "";
  try {
    htmlContent = fs.readFileSync(path.join(__dirname, "../onchain-frontend.html"), "utf8");
    console.log("フロントエンドHTMLを読み込みました");
  } catch (error) {
    console.log("フロントエンドHTMLの読み込みに失敗しました。デフォルトのHTMLを使用します。");
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>フルオンチェーンNFTオークション＆投票サービス</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>フルオンチェーンNFTオークション＆投票サービス</h1>
        <p>このフロントエンドはブロックチェーン上に保存されています。</p>
      </body>
      </html>
    `;
  }

  // フロントエンドストレージコントラクトをデプロイ
  console.log("フロントエンドストレージコントラクトをデプロイ中...");
  const WebAppStorage = await hre.ethers.getContractFactory("WebAppStorage");
  const webAppStorage = await WebAppStorage.deploy(
    "フルオンチェーンNFTオークション＆投票サービス",
    "1.0.0",
    htmlContent,
    "", // 初期CSSコンテンツ
    ""  // 初期JSコンテンツ
  );
  await webAppStorage.deployed();
  console.log("フロントエンドストレージコントラクトがデプロイされました:", webAppStorage.address);

  // 最適化されたフロントエンドストレージコントラクトをデプロイ（オプション）
  console.log("最適化されたフロントエンドストレージコントラクトをデプロイ中...");
  try {
    const WebAppStorageOptimized = await hre.ethers.getContractFactory("WebAppStorageOptimized");
    const webAppStorageOptimized = await WebAppStorageOptimized.deploy(
      "フルオンチェーンNFTオークション＆投票サービス",
      "1.0.0",
      hre.ethers.utils.toUtf8Bytes(htmlContent),
      hre.ethers.utils.toUtf8Bytes(""), // 初期CSSコンテンツ
      hre.ethers.utils.toUtf8Bytes("")  // 初期JSコンテンツ
    );
    await webAppStorageOptimized.deployed();
    console.log("最適化されたフロントエンドストレージコントラクトがデプロイされました:", webAppStorageOptimized.address);
  } catch (error) {
    console.log("最適化されたフロントエンドストレージコントラクトのデプロイに失敗しました:", error.message);
  }

  // デプロイ情報をファイルに保存
  const deploymentInfo = {
    network: hre.network.name,
    nftContract: nftContract.address,
    auctionContract: auctionContract.address,
    votingContract: votingContract.address,
    webAppStorage: webAppStorage.address,
    deployTime: new Date().toISOString(),
    deployer: deployer.address
  };

  fs.writeFileSync(
    path.join(__dirname, `../deployment-${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`デプロイ情報が deployment-${hre.network.name}.json に保存されました`);

  console.log("デプロイが完了しました！");
}

// スクリプトを実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
