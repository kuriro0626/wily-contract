// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./AuctionNFT.sol";

/**
 * @title VotingSystem
 * @dev フルオンチェーンNFTオークションのための投票システムコントラクト
 * NFTホルダーのみが投票お題を提案可能
 * NFTホルダーのみが提案された投票に参加可能
 * 投票結果はブロックチェーン上に永続的に記録される
 */
contract VotingSystem is Ownable {
    using Counters for Counters.Counter;
    
    // 投票提案
    struct Proposal {
        uint256 id;
        string title;
        string description;
        uint256 createdAt;
        uint256 endTime;
        address proposer;
        bool executed;
        uint256 forVotes;
        uint256 againstVotes;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteDirection; // true = for, false = against
    }
    
    // NFTコントラクト
    AuctionNFT public nftContract;
    
    // 提案ID
    Counters.Counter private _proposalIdCounter;
    
    // 提案IDごとの提案情報
    mapping(uint256 => Proposal) public proposals;
    
    // 投票期間（秒）
    uint256 public votingPeriod;
    
    // 最小提案期間（秒）
    uint256 public minProposalPeriod;
    
    // 最大提案期間（秒）
    uint256 public maxProposalPeriod;
    
    // イベント
    event ProposalCreated(uint256 indexed proposalId, string title, address indexed proposer, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event ProposalPeriodLimitsUpdated(uint256 oldMinPeriod, uint256 newMinPeriod, uint256 oldMaxPeriod, uint256 newMaxPeriod);
    
    /**
     * @dev コンストラクタ
     * @param _nftContract NFTコントラクトのアドレス
     * @param _votingPeriod デフォルトの投票期間（秒）
     * @param _minProposalPeriod 最小提案期間（秒）
     * @param _maxProposalPeriod 最大提案期間（秒）
     */
    constructor(
        address _nftContract,
        uint256 _votingPeriod,
        uint256 _minProposalPeriod,
        uint256 _maxProposalPeriod
    ) {
        require(_nftContract != address(0), "VotingSystem: NFTコントラクトは0アドレスにできません");
        require(_votingPeriod > 0, "VotingSystem: 投票期間は0より大きい必要があります");
        require(_minProposalPeriod > 0, "VotingSystem: 最小提案期間は0より大きい必要があります");
        require(_maxProposalPeriod >= _minProposalPeriod, "VotingSystem: 最大提案期間は最小提案期間以上である必要があります");
        
        nftContract = AuctionNFT(_nftContract);
        votingPeriod = _votingPeriod;
        minProposalPeriod = _minProposalPeriod;
        maxProposalPeriod = _maxProposalPeriod;
    }
    
    /**
     * @dev 投票期間を設定
     * @param _votingPeriod 投票期間（秒）
     */
    function setVotingPeriod(uint256 _votingPeriod) external onlyOwner {
        require(_votingPeriod > 0, "VotingSystem: 投票期間は0より大きい必要があります");
        uint256 oldPeriod = votingPeriod;
        votingPeriod = _votingPeriod;
        emit VotingPeriodUpdated(oldPeriod, _votingPeriod);
    }
    
    /**
     * @dev 提案期間の制限を設定
     * @param _minProposalPeriod 最小提案期間（秒）
     * @param _maxProposalPeriod 最大提案期間（秒）
     */
    function setProposalPeriodLimits(uint256 _minProposalPeriod, uint256 _maxProposalPeriod) external onlyOwner {
        require(_minProposalPeriod > 0, "VotingSystem: 最小提案期間は0より大きい必要があります");
        require(_maxProposalPeriod >= _minProposalPeriod, "VotingSystem: 最大提案期間は最小提案期間以上である必要があります");
        
        uint256 oldMinPeriod = minProposalPeriod;
        uint256 oldMaxPeriod = maxProposalPeriod;
        
        minProposalPeriod = _minProposalPeriod;
        maxProposalPeriod = _maxProposalPeriod;
        
        emit ProposalPeriodLimitsUpdated(oldMinPeriod, _minProposalPeriod, oldMaxPeriod, _maxProposalPeriod);
    }
    
    /**
     * @dev 新しい提案を作成する
     * @param title 提案のタイトル
     * @param description 提案の説明
     * @param proposalPeriod 提案期間（秒）
     * @return proposalId 提案ID
     */
    function createProposal(string calldata title, string calldata description, uint256 proposalPeriod) external returns (uint256) {
        // NFTホルダーのみが提案を作成できる
        require(nftContract.balanceOf(msg.sender) > 0, "VotingSystem: NFTホルダーのみが提案を作成できます");
        require(bytes(title).length > 0, "VotingSystem: タイトルは空にできません");
        require(proposalPeriod >= minProposalPeriod && proposalPeriod <= maxProposalPeriod, "VotingSystem: 提案期間が制限外です");
        
        // 提案IDをインクリメント
        _proposalIdCounter.increment();
        uint256 proposalId = _proposalIdCounter.current();
        
        // 提案終了時間を計算
        uint256 endTime = block.timestamp + proposalPeriod;
        
        // 提案を作成
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.createdAt = block.timestamp;
        newProposal.endTime = endTime;
        newProposal.proposer = msg.sender;
        newProposal.executed = false;
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;
        
        emit ProposalCreated(proposalId, title, msg.sender, endTime);
        
        return proposalId;
    }
    
    /**
     * @dev 提案に投票する
     * @param proposalId 提案ID
     * @param support 賛成か反対か（true = 賛成, false = 反対）
     */
    function castVote(uint256 proposalId, bool support) external {
        // NFTホルダーのみが投票できる
        require(nftContract.balanceOf(msg.sender) > 0, "VotingSystem: NFTホルダーのみが投票できます");
        
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id == proposalId, "VotingSystem: 存在しない提案です");
        require(block.timestamp <= proposal.endTime, "VotingSystem: 投票期間が終了しています");
        require(!proposal.executed, "VotingSystem: 提案は既に実行されています");
        require(!proposal.hasVoted[msg.sender], "VotingSystem: 既に投票しています");
        
        // 投票を記録
        proposal.hasVoted[msg.sender] = true;
        proposal.voteDirection[msg.sender] = support;
        
        // 投票をカウント
        if (support) {
            proposal.forVotes += 1;
        } else {
            proposal.againstVotes += 1;
        }
        
        emit VoteCast(proposalId, msg.sender, support);
    }
    
    /**
     * @dev 提案を実行する（投票結果を確定する）
     * @param proposalId 提案ID
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id == proposalId, "VotingSystem: 存在しない提案です");
        require(block.timestamp > proposal.endTime, "VotingSystem: 投票期間がまだ終了していません");
        require(!proposal.executed, "VotingSystem: 提案は既に実行されています");
        
        // 提案を実行済みにマーク
        proposal.executed = true;
        
        // 提案が可決されたかどうかを判定
        bool passed = proposal.forVotes > proposal.againstVotes;
        
        emit ProposalExecuted(proposalId, passed);
    }
    
    /**
     * @dev 提案の詳細情報を取得する
     * @param proposalId 提案ID
     * @return id 提案ID
     * @return title 提案のタイトル
     * @return description 提案の説明
     * @return createdAt 提案作成時間
     * @return endTime 提案終了時間
     * @return proposer 提案者
     * @return executed 実行済みかどうか
     * @return forVotes 賛成票数
     * @return againstVotes 反対票数
     */
    function getProposalDetails(uint256 proposalId) external view returns (
        uint256 id,
        string memory title,
        string memory description,
        uint256 createdAt,
        uint256 endTime,
        address proposer,
        bool executed,
        uint256 forVotes,
        uint256 againstVotes
    ) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id == proposalId, "VotingSystem: 存在しない提案です");
        
        return (
            proposal.id,
            proposal.title,
            proposal.description,
            proposal.createdAt,
            proposal.endTime,
            proposal.proposer,
            proposal.executed,
            proposal.forVotes,
            proposal.againstVotes
        );
    }
    
    /**
     * @dev アドレスが提案に投票したかどうかを確認する
     * @param proposalId 提案ID
     * @param voter 投票者のアドレス
     * @return hasVoted 投票したかどうか
     * @return support 賛成か反対か（true = 賛成, false = 反対）
     */
    function getVoteInfo(uint256 proposalId, address voter) external view returns (bool hasVoted, bool support) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id == proposalId, "VotingSystem: 存在しない提案です");
        
        return (proposal.hasVoted[voter], proposal.voteDirection[voter]);
    }
    
    /**
     * @dev 提案の残り時間を取得する
     * @param proposalId 提案ID
     * @return 残り時間（秒）
     */
    function getRemainingTime(uint256 proposalId) external view returns (uint256) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id == proposalId, "VotingSystem: 存在しない提案です");
        
        if (block.timestamp >= proposal.endTime) {
            return 0;
        }
        
        return proposal.endTime - block.timestamp;
    }
    
    /**
     * @dev 提案が可決されたかどうかを確認する
     * @param proposalId 提案ID
     * @return 可決されたかどうか
     */
    function isProposalPassed(uint256 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id == proposalId, "VotingSystem: 存在しない提案です");
        require(proposal.executed, "VotingSystem: 提案はまだ実行されていません");
        
        return proposal.forVotes > proposal.againstVotes;
    }
    
    /**
     * @dev 提案の総数を取得する
     * @return 提案の総数
     */
    function getProposalCount() external view returns (uint256) {
        return _proposalIdCounter.current();
    }
    
    /**
     * @dev 提案が有効かどうかを確認する
     * @param proposalId 提案ID
     * @return 有効かどうか
     */
    function isProposalActive(uint256 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.id != proposalId) {
            return false;
        }
        
        return !proposal.executed && block.timestamp <= proposal.endTime;
    }
    
    /**
     * @dev 提案が終了したかどうかを確認する
     * @param proposalId 提案ID
     * @return 終了したかどうか
     */
    function isProposalEnded(uint256 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.id != proposalId) {
            return false;
        }
        
        return proposal.executed || block.timestamp > proposal.endTime;
    }
    
    /**
     * @dev 投票の重みを取得する（将来的に拡張可能）
     * @param voter 投票者のアドレス
     * @return 投票の重み
     */
    function getVotingWeight(address voter) public view returns (uint256) {
        // 現在の実装では、NFTの所有数が投票の重みとなる
        return nftContract.balanceOf(voter);
    }
}
