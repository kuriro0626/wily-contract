// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title WebAppStorage
 * @dev フルオンチェーンNFTオークションのためのフロントエンドストレージコントラクト
 * HTML/CSS/JSをブロックチェーン上に保存し、フロントエンドコードを提供する
 */
contract WebAppStorage is Ownable {
    // アプリケーション情報
    string public name;
    string public version;
    
    // フロントエンドコード
    string public htmlContent;
    string public cssContent;
    string public jsContent;
    
    // 許可されたアドレスのマッピング
    mapping(address => bool) public authorizedAddresses;
    
    // イベント
    event HtmlContentUpdated(address indexed updater, uint256 timestamp);
    event CssContentUpdated(address indexed updater, uint256 timestamp);
    event JsContentUpdated(address indexed updater, uint256 timestamp);
    event AuthorizedAddressAdded(address indexed newAddress);
    event AuthorizedAddressRemoved(address indexed removedAddress);
    
    // 許可されたアドレスのみ実行可能な修飾子
    modifier onlyAuthorized() {
        require(msg.sender == owner() || authorizedAddresses[msg.sender], "WebAppStorage: 許可されたアドレスのみ実行可能な操作です");
        _;
    }
    
    /**
     * @dev コンストラクタ
     * @param _name アプリケーション名
     * @param _version アプリケーションバージョン
     * @param _initialHtml 初期HTMLコンテンツ
     * @param _initialCss 初期CSSコンテンツ
     * @param _initialJs 初期JSコンテンツ
     */
    constructor(
        string memory _name,
        string memory _version,
        string memory _initialHtml,
        string memory _initialCss,
        string memory _initialJs
    ) {
        name = _name;
        version = _version;
        htmlContent = _initialHtml;
        cssContent = _initialCss;
        jsContent = _initialJs;
        
        // オーナーは自動的に許可される
        authorizedAddresses[msg.sender] = true;
    }
    
    /**
     * @dev フロントエンドHTMLを取得する
     * @return HTMLコンテンツ
     */
    function getHtml() public view returns (string memory) {
        return htmlContent;
    }
    
    /**
     * @dev フロントエンドCSSを取得する
     * @return CSSコンテンツ
     */
    function getCss() public view returns (string memory) {
        return cssContent;
    }
    
    /**
     * @dev フロントエンドJSを取得する
     * @return JSコンテンツ
     */
    function getJs() public view returns (string memory) {
        return jsContent;
    }
    
    /**
     * @dev 完全なフロントエンドを取得する
     * @return 完全なHTMLコンテンツ（CSS、JSを含む）
     */
    function getFrontend() public view returns (string memory) {
        return htmlContent;
    }
    
    /**
     * @dev HTMLコンテンツを更新する
     * @param _newHtml 新しいHTMLコンテンツ
     */
    function updateHtml(string memory _newHtml) public onlyAuthorized {
        htmlContent = _newHtml;
        emit HtmlContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev CSSコンテンツを更新する
     * @param _newCss 新しいCSSコンテンツ
     */
    function updateCss(string memory _newCss) public onlyAuthorized {
        cssContent = _newCss;
        emit CssContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev JSコンテンツを更新する
     * @param _newJs 新しいJSコンテンツ
     */
    function updateJs(string memory _newJs) public onlyAuthorized {
        jsContent = _newJs;
        emit JsContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev フロントエンド全体を更新する
     * @param _newHtml 新しいHTMLコンテンツ
     * @param _newCss 新しいCSSコンテンツ
     * @param _newJs 新しいJSコンテンツ
     */
    function updateFrontend(
        string memory _newHtml,
        string memory _newCss,
        string memory _newJs
    ) public onlyAuthorized {
        htmlContent = _newHtml;
        cssContent = _newCss;
        jsContent = _newJs;
        
        emit HtmlContentUpdated(msg.sender, block.timestamp);
        emit CssContentUpdated(msg.sender, block.timestamp);
        emit JsContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev 許可されたアドレスを追加する
     * @param _address 追加するアドレス
     */
    function addAuthorizedAddress(address _address) public onlyOwner {
        require(_address != address(0), "WebAppStorage: 0アドレスは許可できません");
        authorizedAddresses[_address] = true;
        emit AuthorizedAddressAdded(_address);
    }
    
    /**
     * @dev 許可されたアドレスを削除する
     * @param _address 削除するアドレス
     */
    function removeAuthorizedAddress(address _address) public onlyOwner {
        require(_address != owner(), "WebAppStorage: オーナーは削除できません");
        authorizedAddresses[_address] = false;
        emit AuthorizedAddressRemoved(_address);
    }
    
    /**
     * @dev アプリケーション名を更新する
     * @param _name 新しいアプリケーション名
     */
    function updateName(string memory _name) public onlyOwner {
        name = _name;
    }
    
    /**
     * @dev アプリケーションバージョンを更新する
     * @param _version 新しいアプリケーションバージョン
     */
    function updateVersion(string memory _version) public onlyOwner {
        version = _version;
    }
    
    /**
     * @dev アドレスが許可されているかどうかを確認する
     * @param _address 確認するアドレス
     * @return 許可されているかどうか
     */
    function isAuthorized(address _address) public view returns (bool) {
        return _address == owner() || authorizedAddresses[_address];
    }
}

/**
 * @title SSTORE2
 * @dev ストレージ最適化のためのライブラリ
 * 大量のデータを効率的に保存するために使用
 */
library SSTORE2 {
    /**
     * @dev データをコントラクトとして保存する
     * @param data 保存するデータ
     * @return dataAddress データが保存されたアドレス
     */
    function write(bytes memory data) internal returns (address dataAddress) {
        // コントラクト作成のためのバイトコードを生成
        bytes memory code = abi.encodePacked(
            bytes1(0x61), // PUSH2
            bytes2(uint16(data.length)), // データの長さ
            bytes1(0x80), // DUP1
            bytes1(0x60), // PUSH1
            bytes1(0x0A), // 10バイト（コードの先頭部分の長さ）
            bytes1(0x3D), // RETURNDATASIZE
            bytes1(0x39), // CODECOPY
            bytes1(0x81), // DUP2
            bytes1(0xF3), // RETURN
            data // 実際のデータ
        );
        
        // コントラクトを作成
        assembly {
            dataAddress := create(0, add(code, 32), mload(code))
            if iszero(dataAddress) { revert(0, 0) }
        }
    }
    
    /**
     * @dev 保存されたデータを読み取る
     * @param dataAddress データが保存されたアドレス
     * @return data 読み取られたデータ
     */
    function read(address dataAddress) internal view returns (bytes memory data) {
        // コントラクトのコードサイズを取得
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(dataAddress)
        }
        
        // コードを読み取る
        data = new bytes(codeSize - 10); // 先頭の10バイトを除く
        assembly {
            extcodecopy(dataAddress, add(data, 32), 10, codeSize - 10)
        }
    }
}

/**
 * @title WebAppStorageOptimized
 * @dev SSTORE2を使用して最適化されたフロントエンドストレージコントラクト
 * 大量のフロントエンドコードを効率的に保存するために使用
 */
contract WebAppStorageOptimized is Ownable {
    using SSTORE2 for bytes;
    
    // アプリケーション情報
    string public name;
    string public version;
    
    // フロントエンドコードのポインタ
    address private htmlPointer;
    address private cssPointer;
    address private jsPointer;
    
    // 許可されたアドレスのマッピング
    mapping(address => bool) public authorizedAddresses;
    
    // イベント
    event HtmlContentUpdated(address indexed updater, uint256 timestamp);
    event CssContentUpdated(address indexed updater, uint256 timestamp);
    event JsContentUpdated(address indexed updater, uint256 timestamp);
    event AuthorizedAddressAdded(address indexed newAddress);
    event AuthorizedAddressRemoved(address indexed removedAddress);
    
    // 許可されたアドレスのみ実行可能な修飾子
    modifier onlyAuthorized() {
        require(msg.sender == owner() || authorizedAddresses[msg.sender], "WebAppStorageOptimized: 許可されたアドレスのみ実行可能な操作です");
        _;
    }
    
    /**
     * @dev コンストラクタ
     * @param _name アプリケーション名
     * @param _version アプリケーションバージョン
     * @param _initialHtml 初期HTMLコンテンツ
     * @param _initialCss 初期CSSコンテンツ
     * @param _initialJs 初期JSコンテンツ
     */
    constructor(
        string memory _name,
        string memory _version,
        bytes memory _initialHtml,
        bytes memory _initialCss,
        bytes memory _initialJs
    ) {
        name = _name;
        version = _version;
        
        // 初期コンテンツを保存
        if (_initialHtml.length > 0) {
            htmlPointer = _initialHtml.write();
        }
        
        if (_initialCss.length > 0) {
            cssPointer = _initialCss.write();
        }
        
        if (_initialJs.length > 0) {
            jsPointer = _initialJs.write();
        }
        
        // オーナーは自動的に許可される
        authorizedAddresses[msg.sender] = true;
    }
    
    /**
     * @dev フロントエンドHTMLを取得する
     * @return HTMLコンテンツ
     */
    function getHtml() public view returns (bytes memory) {
        require(htmlPointer != address(0), "WebAppStorageOptimized: HTMLコンテンツがありません");
        return SSTORE2.read(htmlPointer);
    }
    
    /**
     * @dev フロントエンドCSSを取得する
     * @return CSSコンテンツ
     */
    function getCss() public view returns (bytes memory) {
        require(cssPointer != address(0), "WebAppStorageOptimized: CSSコンテンツがありません");
        return SSTORE2.read(cssPointer);
    }
    
    /**
     * @dev フロントエンドJSを取得する
     * @return JSコンテンツ
     */
    function getJs() public view returns (bytes memory) {
        require(jsPointer != address(0), "WebAppStorageOptimized: JSコンテンツがありません");
        return SSTORE2.read(jsPointer);
    }
    
    /**
     * @dev HTMLコンテンツを更新する
     * @param _newHtml 新しいHTMLコンテンツ
     */
    function updateHtml(bytes calldata _newHtml) public onlyAuthorized {
        htmlPointer = _newHtml.write();
        emit HtmlContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev CSSコンテンツを更新する
     * @param _newCss 新しいCSSコンテンツ
     */
    function updateCss(bytes calldata _newCss) public onlyAuthorized {
        cssPointer = _newCss.write();
        emit CssContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev JSコンテンツを更新する
     * @param _newJs 新しいJSコンテンツ
     */
    function updateJs(bytes calldata _newJs) public onlyAuthorized {
        jsPointer = _newJs.write();
        emit JsContentUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev 許可されたアドレスを追加する
     * @param _address 追加するアドレス
     */
    function addAuthorizedAddress(address _address) public onlyOwner {
        require(_address != address(0), "WebAppStorageOptimized: 0アドレスは許可できません");
        authorizedAddresses[_address] = true;
        emit AuthorizedAddressAdded(_address);
    }
    
    /**
     * @dev 許可されたアドレスを削除する
     * @param _address 削除するアドレス
     */
    function removeAuthorizedAddress(address _address) public onlyOwner {
        require(_address != owner(), "WebAppStorageOptimized: オーナーは削除できません");
        authorizedAddresses[_address] = false;
        emit AuthorizedAddressRemoved(_address);
    }
    
    /**
     * @dev アプリケーション名を更新する
     * @param _name 新しいアプリケーション名
     */
    function updateName(string memory _name) public onlyOwner {
        name = _name;
    }
    
    /**
     * @dev アプリケーションバージョンを更新する
     * @param _version 新しいアプリケーションバージョン
     */
    function updateVersion(string memory _version) public onlyOwner {
        version = _version;
    }
    
    /**
     * @dev アドレスが許可されているかどうかを確認する
     * @param _address 確認するアドレス
     * @return 許可されているかどうか
     */
    function isAuthorized(address _address) public view returns (bool) {
        return _address == owner() || authorizedAddresses[_address];
    }
}
