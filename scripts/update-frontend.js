// フロントエンドコードをWebAppStorageコントラクトに更新するスクリプト
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    // アカウント情報を取得
    const [deployer] = await hre.ethers.getSigners();
    console.log("デプロイアドレス:", deployer.address);
    console.log("アカウント残高:", (await deployer.getBalance()).toString());

    // デプロイ情報を読み込む
    let deploymentInfo;
    try {
      deploymentInfo = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../deployment-${hre.network.name}.json`),
          "utf8"
        )
      );
    } catch (error) {
      console.error(`デプロイ情報の読み込みに失敗しました: ${error.message}`);
      console.error(`deployment-${hre.network.name}.json ファイルが存在するか確認してください。`);
      process.exit(1);
    }

    // WebAppStorageコントラクトのアドレスを取得
    const webAppStorageAddress = deploymentInfo.webAppStorage;
    if (!webAppStorageAddress) {
      console.error("WebAppStorageコントラクトのアドレスが見つかりません。");
      process.exit(1);
    }

    console.log("WebAppStorageコントラクトのアドレス:", webAppStorageAddress);

    // フロントエンドHTMLを読み込む
    let htmlContent = "";
    try {
      htmlContent = fs.readFileSync(path.join(__dirname, "../onchain-frontend.html"), "utf8");
      console.log("フロントエンドHTMLを読み込みました");
    } catch (error) {
      console.error(`フロントエンドHTMLの読み込みに失敗しました: ${error.message}`);
      process.exit(1);
    }

    // CSSを読み込む
    let cssContent = "";
    try {
      cssContent = fs.readFileSync(path.join(__dirname, "../css/styles.css"), "utf8");
      console.log("CSSを読み込みました");
    } catch (error) {
      console.log("CSSの読み込みに失敗しました。空のCSSを使用します。");
    }

    // JSを読み込む
    let jsContent = "";
    try {
      // web3.jsとapp.jsを結合
      const web3Js = fs.readFileSync(path.join(__dirname, "../js/web3.js"), "utf8");
      const appJs = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
      jsContent = web3Js + "\n" + appJs;
      console.log("JSを読み込みました");
    } catch (error) {
      console.log("JSの読み込みに失敗しました。空のJSを使用します。");
    }

    // コントラクトアドレスを更新
    htmlContent = updateContractAddresses(htmlContent, deploymentInfo);

    // WebAppStorageコントラクトのインスタンスを取得
    const WebAppStorage = await hre.ethers.getContractFactory("WebAppStorage");
    const webAppStorage = WebAppStorage.attach(webAppStorageAddress);

    // 通常のWebAppStorageコントラクトを使用してフロントエンドを更新
    console.log("WebAppStorageコントラクトにフロントエンドを更新中...");
    
    // HTMLを更新
    console.log("HTMLを更新中...");
    const htmlTx = await webAppStorage.updateHtml(htmlContent);
    await htmlTx.wait();
    console.log("HTMLを更新しました");
    
    // CSSを更新
    if (cssContent) {
      console.log("CSSを更新中...");
      const cssTx = await webAppStorage.updateCss(cssContent);
      await cssTx.wait();
      console.log("CSSを更新しました");
    }
    
    // JSを更新
    if (jsContent) {
      console.log("JSを更新中...");
      const jsTx = await webAppStorage.updateJs(jsContent);
      await jsTx.wait();
      console.log("JSを更新しました");
    }

    // 最適化されたWebAppStorageコントラクトも更新（存在する場合）
    try {
      const webAppStorageOptimizedAddress = deploymentInfo.webAppStorageOptimized;
      if (webAppStorageOptimizedAddress) {
        console.log("最適化されたWebAppStorageコントラクトのアドレス:", webAppStorageOptimizedAddress);
        
        const WebAppStorageOptimized = await hre.ethers.getContractFactory("WebAppStorageOptimized");
        const webAppStorageOptimized = WebAppStorageOptimized.attach(webAppStorageOptimizedAddress);
        
        console.log("最適化されたWebAppStorageコントラクトにフロントエンドを更新中...");
        
        // HTMLを更新
        console.log("最適化されたHTMLを更新中...");
        const htmlTx = await webAppStorageOptimized.updateHtml(hre.ethers.utils.toUtf8Bytes(htmlContent));
        await htmlTx.wait();
        console.log("最適化されたHTMLを更新しました");
        
        // CSSを更新
        if (cssContent) {
          console.log("最適化されたCSSを更新中...");
          const cssTx = await webAppStorageOptimized.updateCss(hre.ethers.utils.toUtf8Bytes(cssContent));
          await cssTx.wait();
          console.log("最適化されたCSSを更新しました");
        }
        
        // JSを更新
        if (jsContent) {
          console.log("最適化されたJSを更新中...");
          const jsTx = await webAppStorageOptimized.updateJs(hre.ethers.utils.toUtf8Bytes(jsContent));
          await jsTx.wait();
          console.log("最適化されたJSを更新しました");
        }
      }
    } catch (error) {
      console.log("最適化されたWebAppStorageコントラクトの更新に失敗しました:", error.message);
    }

    console.log("フロントエンドの更新が完了しました！");
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

// HTMLコード内のコントラクトアドレスを更新する関数
function updateContractAddresses(htmlContent, deploymentInfo) {
  const addressPattern = /const CONTRACT_ADDRESSES = \{[^}]*\}/;
  const newAddresses = `const CONTRACT_ADDRESSES = {
  nft: "${deploymentInfo.nftContract}",
  auction: "${deploymentInfo.auctionContract}",
  voting: "${deploymentInfo.votingContract}",
  webAppStorage: "${deploymentInfo.webAppStorage}"
}`;

  // アドレス部分を置換
  if (addressPattern.test(htmlContent)) {
    return htmlContent.replace(addressPattern, newAddresses);
  } else {
    // アドレス定義が見つからない場合は、<script>タグの直後に追加
    return htmlContent.replace(/<script>/, `<script>\n${newAddresses}`);
  }
}

// スクリプトを実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
