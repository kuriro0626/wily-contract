# Wily-contract

このリポジトリは、Wilyサービス（フルオンチェーンNFTオークション＆投票サービス）のスマートコントラクトコードを管理するためのリポジトリです。

## 概要

Wily-contractは、Wilyサービスのスマートコントラクトに関連するコードを管理します。これらのコントラクトはブロックチェーン上でNFTの発行、オークション、投票システム、およびフロントエンドコードの保存を担当します。

## ファイル構成

### スマートコントラクト
- `contracts/AuctionNFT.sol` - NFTコントラクト（ERC-721）
- `contracts/Auction.sol` - オークションコントラクト
- `contracts/VotingSystem.sol` - 投票システムコントラクト
- `contracts/WebAppStorage.sol` - フロントエンドストレージコントラクト

### デプロイメント
- `scripts/deploy.js` - コントラクトデプロイスクリプト
- `scripts/update-frontend.js` - フロントエンドコードをブロックチェーンに更新するスクリプト
- `hardhat.config.js` - Hardhat設定ファイル
- `.env.example` - 環境変数のサンプルファイル

### テスト
- `test/AuctionNFT.test.js` - NFTコントラクトのテスト
- `test/Auction.test.js` - オークションコントラクトのテスト
- `test/VotingSystem.test.js` - 投票システムコントラクトのテスト
- `test/WebAppStorage.test.js` - フロントエンドストレージコントラクトのテスト

## セットアップと実行方法

### 前提条件
- Node.js (v14以上)
- npm または yarn
- MetaMaskなどのイーサリアム互換ウォレット

### インストール

1. リポジトリをクローン
   ```
   git clone https://github.com/yourusername/wily-contract.git
   cd wily-contract
   ```

2. 依存関係をインストール
   ```
   npm install
   ```

3. 環境変数を設定
   ```
   cp .env.example .env
   ```
   `.env`ファイルを編集して、必要な情報を入力してください。

### コントラクトのコンパイル
```
npm run compile
```

### ローカルでのテスト
```
npm run node
```
別のターミナルで:
```
npm run deploy:local
```

## オンチェーンへのデプロイ

### スマートコントラクトのデプロイ
Arbitrumメインネットにデプロイする:
```
npm run deploy
```

### フロントエンドコードのデプロイ
フロントエンドコードをブロックチェーンにデプロイするには以下のコマンドを実行します：
```
npm run update-frontend
```

詳細な手順については、wily-docリポジトリの「オンチェーンデプロイ手順書」を参照してください。

## スマートコントラクトの概要

### AuctionNFT.sol
ERC-721標準に準拠したNFTコントラクトで、以下の機能を提供します：
- 毎日1つのNFTを自動的にmint
- 10の倍数のNFT（#10, #20, #30...）は特定のアドレスに直接mint
- SVGベースのオンチェーンNFTアート生成
- オークション結果のメタデータへの記録

### Auction.sol
NFTオークションを管理するコントラクトで、以下の機能を提供します：
- 日次オークションの作成と管理
- 入札処理と最小入札増加率の適用
- オークション終了と落札処理
- オークション収益のトレジャリーへの送金

### VotingSystem.sol
NFTホルダー向けの投票システムを提供するコントラクトで、以下の機能を含みます：
- 投票提案の作成と管理
- NFTホルダーによる投票
- 投票結果の集計と記録
- 提案の実行と結果の確定

### WebAppStorage.sol
フロントエンドコードをブロックチェーン上に保存するためのコントラクトで、以下の機能を提供します：
- HTML/CSS/JSコードの保存
- 許可されたアドレスによるコード更新
- 最適化されたストレージ（SSTORE2）の実装

## 技術スタック

- **スマートコントラクト**: Solidity 0.8.17
- **開発フレームワーク**: Hardhat
- **テスト**: Chai, Hardhat Network Helpers
- **推奨チェーン**: Arbitrum（低ガスコストでフロントエンド保存に最適）

## ライセンス

MIT
