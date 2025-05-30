const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WebAppStorage", function () {
  let WebAppStorage;
  let WebAppStorageOptimized;
  let webAppStorage;
  let webAppStorageOptimized;
  let owner;
  let addr1;
  let addr2;
  let initialHtml;
  let initialCss;
  let initialJs;

  beforeEach(async function () {
    // コントラクトとアカウントの設定
    [owner, addr1, addr2] = await ethers.getSigners();
    
    initialHtml = "<html><body><h1>フルオンチェーンNFTオークション＆投票サービス</h1></body></html>";
    initialCss = "body { font-family: Arial, sans-serif; }";
    initialJs = "console.log('フルオンチェーンアプリケーション');";

    // 通常のWebAppStorageコントラクトのデプロイ
    WebAppStorage = await ethers.getContractFactory("WebAppStorage");
    webAppStorage = await WebAppStorage.deploy(
      "フルオンチェーンNFTオークション＆投票サービス",
      "1.0.0",
      initialHtml,
      initialCss,
      initialJs
    );
    await webAppStorage.deployed();

    // 最適化されたWebAppStorageOptimizedコントラクトのデプロイ
    WebAppStorageOptimized = await ethers.getContractFactory("WebAppStorageOptimized");
    webAppStorageOptimized = await WebAppStorageOptimized.deploy(
      "フルオンチェーンNFTオークション＆投票サービス",
      "1.0.0",
      ethers.utils.toUtf8Bytes(initialHtml),
      ethers.utils.toUtf8Bytes(initialCss),
      ethers.utils.toUtf8Bytes(initialJs)
    );
    await webAppStorageOptimized.deployed();
  });

  describe("WebAppStorage", function () {
    describe("デプロイメント", function () {
      it("アプリケーション名とバージョンが正しく設定されるべき", async function () {
        expect(await webAppStorage.name()).to.equal("フルオンチェーンNFTオークション＆投票サービス");
        expect(await webAppStorage.version()).to.equal("1.0.0");
      });

      it("初期コンテンツが正しく設定されるべき", async function () {
        expect(await webAppStorage.htmlContent()).to.equal(initialHtml);
        expect(await webAppStorage.cssContent()).to.equal(initialCss);
        expect(await webAppStorage.jsContent()).to.equal(initialJs);
      });

      it("オーナーは自動的に許可されるべき", async function () {
        expect(await webAppStorage.isAuthorized(owner.address)).to.be.true;
      });
    });

    describe("コンテンツの取得", function () {
      it("HTMLコンテンツを取得できるべき", async function () {
        expect(await webAppStorage.getHtml()).to.equal(initialHtml);
      });

      it("CSSコンテンツを取得できるべき", async function () {
        expect(await webAppStorage.getCss()).to.equal(initialCss);
      });

      it("JSコンテンツを取得できるべき", async function () {
        expect(await webAppStorage.getJs()).to.equal(initialJs);
      });

      it("フロントエンド全体を取得できるべき", async function () {
        expect(await webAppStorage.getFrontend()).to.equal(initialHtml);
      });
    });

    describe("コンテンツの更新", function () {
      it("許可されたアドレスのみがHTMLコンテンツを更新できるべき", async function () {
        const newHtml = "<html><body><h1>更新されたHTML</h1></body></html>";
        
        // オーナーが更新
        await webAppStorage.updateHtml(newHtml);
        expect(await webAppStorage.getHtml()).to.equal(newHtml);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorage.connect(addr1).updateHtml("<html>不正な更新</html>")
        ).to.be.revertedWith("WebAppStorage: 許可されたアドレスのみ実行可能な操作です");
        
        // addr1を許可
        await webAppStorage.addAuthorizedAddress(addr1.address);
        
        // 許可されたアドレスからの更新は成功するべき
        const newHtml2 = "<html><body><h1>addr1による更新</h1></body></html>";
        await webAppStorage.connect(addr1).updateHtml(newHtml2);
        expect(await webAppStorage.getHtml()).to.equal(newHtml2);
      });

      it("許可されたアドレスのみがCSSコンテンツを更新できるべき", async function () {
        const newCss = "body { font-family: 'Roboto', sans-serif; }";
        
        // オーナーが更新
        await webAppStorage.updateCss(newCss);
        expect(await webAppStorage.getCss()).to.equal(newCss);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorage.connect(addr1).updateCss("body { color: red; }")
        ).to.be.revertedWith("WebAppStorage: 許可されたアドレスのみ実行可能な操作です");
      });

      it("許可されたアドレスのみがJSコンテンツを更新できるべき", async function () {
        const newJs = "console.log('更新されたJavaScript');";
        
        // オーナーが更新
        await webAppStorage.updateJs(newJs);
        expect(await webAppStorage.getJs()).to.equal(newJs);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorage.connect(addr1).updateJs("alert('不正な更新');")
        ).to.be.revertedWith("WebAppStorage: 許可されたアドレスのみ実行可能な操作です");
      });

      it("許可されたアドレスのみがフロントエンド全体を更新できるべき", async function () {
        const newHtml = "<html><body><h1>新しいHTML</h1></body></html>";
        const newCss = "body { background-color: #f0f0f0; }";
        const newJs = "document.addEventListener('DOMContentLoaded', function() { console.log('ロード完了'); });";
        
        // オーナーが更新
        await webAppStorage.updateFrontend(newHtml, newCss, newJs);
        
        expect(await webAppStorage.getHtml()).to.equal(newHtml);
        expect(await webAppStorage.getCss()).to.equal(newCss);
        expect(await webAppStorage.getJs()).to.equal(newJs);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorage.connect(addr1).updateFrontend("", "", "")
        ).to.be.revertedWith("WebAppStorage: 許可されたアドレスのみ実行可能な操作です");
      });
    });

    describe("許可されたアドレスの管理", function () {
      it("オーナーのみが許可されたアドレスを追加できるべき", async function () {
        // 初期状態ではaddr1は許可されていない
        expect(await webAppStorage.isAuthorized(addr1.address)).to.be.false;
        
        // オーナーがaddr1を許可
        await webAppStorage.addAuthorizedAddress(addr1.address);
        expect(await webAppStorage.isAuthorized(addr1.address)).to.be.true;
        
        // 他のアドレスからの許可追加は失敗するべき
        await expect(
          webAppStorage.connect(addr1).addAuthorizedAddress(addr2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("オーナーのみが許可されたアドレスを削除できるべき", async function () {
        // addr1を許可
        await webAppStorage.addAuthorizedAddress(addr1.address);
        expect(await webAppStorage.isAuthorized(addr1.address)).to.be.true;
        
        // オーナーがaddr1の許可を削除
        await webAppStorage.removeAuthorizedAddress(addr1.address);
        expect(await webAppStorage.isAuthorized(addr1.address)).to.be.false;
        
        // 他のアドレスからの許可削除は失敗するべき
        await webAppStorage.addAuthorizedAddress(addr1.address);
        await expect(
          webAppStorage.connect(addr1).removeAuthorizedAddress(addr2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("オーナーは削除できないべき", async function () {
        await expect(
          webAppStorage.removeAuthorizedAddress(owner.address)
        ).to.be.revertedWith("WebAppStorage: オーナーは削除できません");
      });

      it("0アドレスは許可できないべき", async function () {
        await expect(
          webAppStorage.addAuthorizedAddress(ethers.constants.AddressZero)
        ).to.be.revertedWith("WebAppStorage: 0アドレスは許可できません");
      });
    });

    describe("アプリケーション情報の更新", function () {
      it("オーナーのみがアプリケーション名を更新できるべき", async function () {
        const newName = "更新されたアプリケーション名";
        
        // オーナーが更新
        await webAppStorage.updateName(newName);
        expect(await webAppStorage.name()).to.equal(newName);
        
        // 他のアドレスからの更新は失敗するべき
        await expect(
          webAppStorage.connect(addr1).updateName("不正な名前")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("オーナーのみがアプリケーションバージョンを更新できるべき", async function () {
        const newVersion = "2.0.0";
        
        // オーナーが更新
        await webAppStorage.updateVersion(newVersion);
        expect(await webAppStorage.version()).to.equal(newVersion);
        
        // 他のアドレスからの更新は失敗するべき
        await expect(
          webAppStorage.connect(addr1).updateVersion("999.0.0")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("WebAppStorageOptimized", function () {
    describe("デプロイメント", function () {
      it("アプリケーション名とバージョンが正しく設定されるべき", async function () {
        expect(await webAppStorageOptimized.name()).to.equal("フルオンチェーンNFTオークション＆投票サービス");
        expect(await webAppStorageOptimized.version()).to.equal("1.0.0");
      });

      it("オーナーは自動的に許可されるべき", async function () {
        expect(await webAppStorageOptimized.isAuthorized(owner.address)).to.be.true;
      });
    });

    describe("コンテンツの取得", function () {
      it("HTMLコンテンツを取得できるべき", async function () {
        const html = await webAppStorageOptimized.getHtml();
        expect(ethers.utils.toUtf8String(html)).to.equal(initialHtml);
      });

      it("CSSコンテンツを取得できるべき", async function () {
        const css = await webAppStorageOptimized.getCss();
        expect(ethers.utils.toUtf8String(css)).to.equal(initialCss);
      });

      it("JSコンテンツを取得できるべき", async function () {
        const js = await webAppStorageOptimized.getJs();
        expect(ethers.utils.toUtf8String(js)).to.equal(initialJs);
      });
    });

    describe("コンテンツの更新", function () {
      it("許可されたアドレスのみがHTMLコンテンツを更新できるべき", async function () {
        const newHtml = "<html><body><h1>更新されたHTML</h1></body></html>";
        
        // オーナーが更新
        await webAppStorageOptimized.updateHtml(ethers.utils.toUtf8Bytes(newHtml));
        const html = await webAppStorageOptimized.getHtml();
        expect(ethers.utils.toUtf8String(html)).to.equal(newHtml);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorageOptimized.connect(addr1).updateHtml(ethers.utils.toUtf8Bytes("<html>不正な更新</html>"))
        ).to.be.revertedWith("WebAppStorageOptimized: 許可されたアドレスのみ実行可能な操作です");
      });

      it("許可されたアドレスのみがCSSコンテンツを更新できるべき", async function () {
        const newCss = "body { font-family: 'Roboto', sans-serif; }";
        
        // オーナーが更新
        await webAppStorageOptimized.updateCss(ethers.utils.toUtf8Bytes(newCss));
        const css = await webAppStorageOptimized.getCss();
        expect(ethers.utils.toUtf8String(css)).to.equal(newCss);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorageOptimized.connect(addr1).updateCss(ethers.utils.toUtf8Bytes("body { color: red; }"))
        ).to.be.revertedWith("WebAppStorageOptimized: 許可されたアドレスのみ実行可能な操作です");
      });

      it("許可されたアドレスのみがJSコンテンツを更新できるべき", async function () {
        const newJs = "console.log('更新されたJavaScript');";
        
        // オーナーが更新
        await webAppStorageOptimized.updateJs(ethers.utils.toUtf8Bytes(newJs));
        const js = await webAppStorageOptimized.getJs();
        expect(ethers.utils.toUtf8String(js)).to.equal(newJs);
        
        // 許可されていないアドレスからの更新は失敗するべき
        await expect(
          webAppStorageOptimized.connect(addr1).updateJs(ethers.utils.toUtf8Bytes("alert('不正な更新');"))
        ).to.be.revertedWith("WebAppStorageOptimized: 許可されたアドレスのみ実行可能な操作です");
      });
    });

    describe("許可されたアドレスの管理", function () {
      it("オーナーのみが許可されたアドレスを追加できるべき", async function () {
        // 初期状態ではaddr1は許可されていない
        expect(await webAppStorageOptimized.isAuthorized(addr1.address)).to.be.false;
        
        // オーナーがaddr1を許可
        await webAppStorageOptimized.addAuthorizedAddress(addr1.address);
        expect(await webAppStorageOptimized.isAuthorized(addr1.address)).to.be.true;
        
        // 他のアドレスからの許可追加は失敗するべき
        await expect(
          webAppStorageOptimized.connect(addr1).addAuthorizedAddress(addr2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("オーナーのみが許可されたアドレスを削除できるべき", async function () {
        // addr1を許可
        await webAppStorageOptimized.addAuthorizedAddress(addr1.address);
        expect(await webAppStorageOptimized.isAuthorized(addr1.address)).to.be.true;
        
        // オーナーがaddr1の許可を削除
        await webAppStorageOptimized.removeAuthorizedAddress(addr1.address);
        expect(await webAppStorageOptimized.isAuthorized(addr1.address)).to.be.false;
        
        // 他のアドレスからの許可削除は失敗するべき
        await webAppStorageOptimized.addAuthorizedAddress(addr1.address);
        await expect(
          webAppStorageOptimized.connect(addr1).removeAuthorizedAddress(addr2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("オーナーは削除できないべき", async function () {
        await expect(
          webAppStorageOptimized.removeAuthorizedAddress(owner.address)
        ).to.be.revertedWith("WebAppStorageOptimized: オーナーは削除できません");
      });

      it("0アドレスは許可できないべき", async function () {
        await expect(
          webAppStorageOptimized.addAuthorizedAddress(ethers.constants.AddressZero)
        ).to.be.revertedWith("WebAppStorageOptimized: 0アドレスは許可できません");
      });
    });

    describe("アプリケーション情報の更新", function () {
      it("オーナーのみがアプリケーション名を更新できるべき", async function () {
        const newName = "更新されたアプリケーション名";
        
        // オーナーが更新
        await webAppStorageOptimized.updateName(newName);
        expect(await webAppStorageOptimized.name()).to.equal(newName);
        
        // 他のアドレスからの更新は失敗するべき
        await expect(
          webAppStorageOptimized.connect(addr1).updateName("不正な名前")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("オーナーのみがアプリケーションバージョンを更新できるべき", async function () {
        const newVersion = "2.0.0";
        
        // オーナーが更新
        await webAppStorageOptimized.updateVersion(newVersion);
        expect(await webAppStorageOptimized.version()).to.equal(newVersion);
        
        // 他のアドレスからの更新は失敗するべき
        await expect(
          webAppStorageOptimized.connect(addr1).updateVersion("999.0.0")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });
});
