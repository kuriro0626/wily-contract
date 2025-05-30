// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title AuctionNFT
 * @dev フルオンチェーンNFTオークションのためのNFTコントラクト
 * 毎日1つのNFTが自動的にmintされ、オークションにかけられる
 * 10の倍数のNFT（#10, #20, #30...）は特定のリストに登録されたアドレス群からランダムに選ばれたアドレスに直接mintされる
 */
contract AuctionNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    // NFTのメタデータ
    struct NFTMetadata {
        string name;
        string description;
        string image;
        uint256 createdAt;
        uint256 auctionEndTime;
        uint256 winningBid;
        address winner;
    }

    // トークンIDごとのメタデータを保存
    mapping(uint256 => NFTMetadata) private _tokenMetadata;
    
    // 特別なmint（10の倍数）のためのアドレスリスト
    address[] public specialMintAddresses;
    
    // オークションコントラクトのアドレス
    address public auctionContract;
    
    // トレジャリーのアドレス
    address public treasuryAddress;
    
    // 次にmintされるトークンID
    uint256 public nextTokenId = 1;
    
    // 最後のmint時間
    uint256 public lastMintTime;
    
    // 1日のミリ秒数
    uint256 private constant ONE_DAY = 24 * 60 * 60;
    
    // イベント
    event NFTMinted(uint256 indexed tokenId, address indexed recipient, bool isSpecialMint);
    event AuctionContractUpdated(address indexed oldAddress, address indexed newAddress);
    event TreasuryAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event SpecialMintAddressesUpdated();
    
    // オークションコントラクトのみ実行可能な修飾子
    modifier onlyAuctionContract() {
        require(msg.sender == auctionContract, "AuctionNFT: 呼び出し元はオークションコントラクトである必要があります");
        _;
    }
    
    /**
     * @dev コンストラクタ
     * @param name_ NFTコレクションの名前
     * @param symbol_ NFTコレクションのシンボル
     * @param treasuryAddress_ トレジャリーのアドレス
     * @param specialAddresses 特別なmint（10の倍数）のためのアドレスリスト
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address treasuryAddress_,
        address[] memory specialAddresses
    ) ERC721(name_, symbol_) {
        require(treasuryAddress_ != address(0), "AuctionNFT: トレジャリーアドレスは0アドレスにできません");
        treasuryAddress = treasuryAddress_;
        
        // 特別なmintアドレスを設定
        for (uint256 i = 0; i < specialAddresses.length; i++) {
            require(specialAddresses[i] != address(0), "AuctionNFT: 特別なmintアドレスは0アドレスにできません");
            specialMintAddresses.push(specialAddresses[i]);
        }
        
        // 最初のmint時間を設定
        lastMintTime = block.timestamp;
    }
    
    /**
     * @dev オークションコントラクトのアドレスを設定
     * @param _auctionContract オークションコントラクトのアドレス
     */
    function setAuctionContract(address _auctionContract) external onlyOwner {
        require(_auctionContract != address(0), "AuctionNFT: オークションコントラクトは0アドレスにできません");
        address oldAuctionContract = auctionContract;
        auctionContract = _auctionContract;
        emit AuctionContractUpdated(oldAuctionContract, _auctionContract);
    }
    
    /**
     * @dev トレジャリーのアドレスを設定
     * @param _treasuryAddress トレジャリーのアドレス
     */
    function setTreasuryAddress(address _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "AuctionNFT: トレジャリーアドレスは0アドレスにできません");
        address oldTreasuryAddress = treasuryAddress;
        treasuryAddress = _treasuryAddress;
        emit TreasuryAddressUpdated(oldTreasuryAddress, _treasuryAddress);
    }
    
    /**
     * @dev 特別なmintアドレスリストを設定
     * @param _specialMintAddresses 特別なmintアドレスリスト
     */
    function setSpecialMintAddresses(address[] calldata _specialMintAddresses) external onlyOwner {
        delete specialMintAddresses;
        for (uint256 i = 0; i < _specialMintAddresses.length; i++) {
            require(_specialMintAddresses[i] != address(0), "AuctionNFT: 特別なmintアドレスは0アドレスにできません");
            specialMintAddresses.push(_specialMintAddresses[i]);
        }
        emit SpecialMintAddressesUpdated();
    }
    
    /**
     * @dev 新しいNFTをmintする（オークションコントラクトからのみ呼び出し可能）
     * @param recipient NFTの受取人
     * @param auctionEndTime オークション終了時間
     * @return tokenId mintされたトークンID
     */
    function mintNFT(address recipient, uint256 auctionEndTime) external onlyAuctionContract returns (uint256) {
        require(recipient != address(0), "AuctionNFT: 受取人は0アドレスにできません");
        require(block.timestamp >= lastMintTime + ONE_DAY, "AuctionNFT: 1日に1つのNFTしかmintできません");
        
        uint256 tokenId = nextTokenId;
        
        // 10の倍数のトークンIDの場合、特別なmintを実行
        bool isSpecialMint = tokenId % 10 == 0;
        
        if (isSpecialMint && specialMintAddresses.length > 0) {
            // 特別なmintアドレスからランダムに選択
            uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, tokenId))) % specialMintAddresses.length;
            recipient = specialMintAddresses[randomIndex];
        }
        
        // NFTをmint
        _safeMint(recipient, tokenId);
        
        // メタデータを設定
        _tokenMetadata[tokenId] = NFTMetadata({
            name: string(abi.encodePacked("Auction NFT #", tokenId.toString())),
            description: "フルオンチェーンNFTオークションで作成されたNFT",
            image: _generateSVGImage(tokenId),
            createdAt: block.timestamp,
            auctionEndTime: auctionEndTime,
            winningBid: 0,
            winner: address(0)
        });
        
        // 次のトークンIDを更新
        nextTokenId++;
        
        // 最後のmint時間を更新
        lastMintTime = block.timestamp;
        
        emit NFTMinted(tokenId, recipient, isSpecialMint);
        
        return tokenId;
    }
    
    /**
     * @dev オークション結果を更新する（オークションコントラクトからのみ呼び出し可能）
     * @param tokenId 更新するトークンID
     * @param winningBid 落札額
     * @param winner 落札者
     */
    function updateAuctionResult(uint256 tokenId, uint256 winningBid, address winner) external onlyAuctionContract {
        require(_exists(tokenId), "AuctionNFT: 存在しないトークンIDです");
        
        _tokenMetadata[tokenId].winningBid = winningBid;
        _tokenMetadata[tokenId].winner = winner;
    }
    
    /**
     * @dev トークンURIを生成する
     * @param tokenId トークンID
     * @return トークンURI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "AuctionNFT: 存在しないトークンIDのURIをクエリしています");
        
        NFTMetadata memory metadata = _tokenMetadata[tokenId];
        
        // JSON形式のメタデータを作成
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"', metadata.name, '",',
                        '"description":"', metadata.description, '",',
                        '"image":"', metadata.image, '",',
                        '"attributes":[',
                            '{"trait_type":"Created At","value":"', _formatTimestamp(metadata.createdAt), '"},',
                            '{"trait_type":"Auction End Time","value":"', _formatTimestamp(metadata.auctionEndTime), '"},',
                            '{"trait_type":"Winning Bid","value":"', metadata.winningBid.toString(), ' ETH"},',
                            '{"trait_type":"Winner","value":"', _addressToString(metadata.winner), '"}',
                        ']}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    /**
     * @dev SVG画像を生成する
     * @param tokenId トークンID
     * @return SVG画像のdata URI
     */
    function _generateSVGImage(uint256 tokenId) internal pure returns (string memory) {
        // トークンIDに基づいて色を生成
        string memory color1 = _generateColor(tokenId);
        string memory color2 = _generateColor(tokenId + 1);
        string memory color3 = _generateColor(tokenId + 2);
        
        // SVG画像を生成
        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">',
                '<rect width="500" height="500" fill="', color1, '" />',
                '<circle cx="250" cy="250" r="150" fill="', color2, '" />',
                '<text x="250" y="250" font-family="Arial" font-size="40" text-anchor="middle" fill="', color3, '">NFT #', tokenId.toString(), '</text>',
                '</svg>'
            )
        );
        
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
    }
    
    /**
     * @dev トークンIDに基づいて色を生成する
     * @param seed 色生成のためのシード
     * @return 16進数形式の色コード
     */
    function _generateColor(uint256 seed) internal pure returns (string memory) {
        bytes32 hash = keccak256(abi.encodePacked(seed));
        uint256 color = uint256(hash) % 0xFFFFFF;
        return string(abi.encodePacked("#", _toHexString(color, 6)));
    }
    
    /**
     * @dev 数値を16進数文字列に変換する
     * @param value 変換する数値
     * @param length 16進数文字列の長さ
     * @return 16進数文字列
     */
    function _toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(length);
        for (uint256 i = length; i > 0; i--) {
            buffer[i - 1] = bytes1(uint8(48 + uint256(value % 16)));
            if (uint8(buffer[i - 1]) > 57) {
                buffer[i - 1] = bytes1(uint8(buffer[i - 1]) + 39);
            }
            value /= 16;
        }
        return string(buffer);
    }
    
    /**
     * @dev タイムスタンプを人間が読める形式に変換する
     * @param timestamp UNIXタイムスタンプ
     * @return フォーマットされた日時文字列
     */
    function _formatTimestamp(uint256 timestamp) internal pure returns (string memory) {
        if (timestamp == 0) return "N/A";
        return timestamp.toString();
    }
    
    /**
     * @dev アドレスを文字列に変換する
     * @param addr イーサリアムアドレス
     * @return アドレス文字列
     */
    function _addressToString(address addr) internal pure returns (string memory) {
        if (addr == address(0)) return "N/A";
        return Strings.toHexString(uint256(uint160(addr)), 20);
    }
    
    /**
     * @dev 特別なmintアドレスの数を取得する
     * @return 特別なmintアドレスの数
     */
    function getSpecialMintAddressesCount() external view returns (uint256) {
        return specialMintAddresses.length;
    }
    
    /**
     * @dev コントラクトが受け取ったETHをトレジャリーに転送する
     */
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "AuctionNFT: 残高がありません");
        
        (bool success, ) = treasuryAddress.call{value: balance}("");
        require(success, "AuctionNFT: 送金に失敗しました");
    }
    
    /**
     * @dev コントラクトがETHを受け取れるようにする
     */
    receive() external payable {}
}
