// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IAgenticCommerce {
    function complete(
        uint256 jobId,
        bytes32 reason,
        bytes calldata optParams
    ) external;

    function reject(
        uint256 jobId,
        bytes32 reason,
        bytes calldata optParams
    ) external;
}

/// @notice Evidence is verified by a threshold of independent approvers
/// rather than a single owner. A job clears or is rejected only once
/// `threshold` distinct approvers agree on the same outcome.
contract ClearXEvaluator {
    IAgenticCommerce public immutable commerce;
    uint256 public immutable threshold;

    address[] public approvers;
    mapping(address => bool) public isApprover;

    struct Vote {
        uint256 approveCount;
        uint256 rejectCount;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Vote) private votes;

    error Unauthorized();
    error InvalidThreshold();
    error DuplicateApprover();
    error AlreadyVoted();
    error AlreadyExecuted();

    event EvidenceVoted(
        uint256 indexed jobId,
        address indexed approver,
        bytes32 indexed evidenceHash,
        bool approve
    );

    event EvidenceVerified(
        uint256 indexed jobId,
        bytes32 indexed evidenceHash,
        bool approved
    );

    modifier onlyApprover() {
        if (!isApprover[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(
        address commerce_,
        address[] memory approvers_,
        uint256 threshold_
    ) {
        if (commerce_ == address(0)) revert Unauthorized();
        if (threshold_ == 0 || threshold_ > approvers_.length) {
            revert InvalidThreshold();
        }

        commerce = IAgenticCommerce(commerce_);
        threshold = threshold_;

        for (uint256 i = 0; i < approvers_.length; i++) {
            address a = approvers_[i];

            if (a == address(0)) revert Unauthorized();
            if (isApprover[a]) revert DuplicateApprover();

            isApprover[a] = true;
            approvers.push(a);
        }
    }

    function approve(
        uint256 jobId,
        bytes32 evidenceHash
    ) external onlyApprover {
        Vote storage v = votes[jobId];

        if (v.executed) revert AlreadyExecuted();
        if (v.hasVoted[msg.sender]) revert AlreadyVoted();

        v.hasVoted[msg.sender] = true;
        v.approveCount++;

        emit EvidenceVoted(jobId, msg.sender, evidenceHash, true);

        if (v.approveCount >= threshold) {
            v.executed = true;

            emit EvidenceVerified(jobId, evidenceHash, true);

            commerce.complete(jobId, evidenceHash, "");
        }
    }

    function reject(
        uint256 jobId,
        bytes32 evidenceHash
    ) external onlyApprover {
        Vote storage v = votes[jobId];

        if (v.executed) revert AlreadyExecuted();
        if (v.hasVoted[msg.sender]) revert AlreadyVoted();

        v.hasVoted[msg.sender] = true;
        v.rejectCount++;

        emit EvidenceVoted(jobId, msg.sender, evidenceHash, false);

        if (v.rejectCount >= threshold) {
            v.executed = true;

            emit EvidenceVerified(jobId, evidenceHash, false);

            commerce.reject(jobId, evidenceHash, "");
        }
    }

    function approverCount() external view returns (uint256) {
        return approvers.length;
    }

    function hasVoted(
        uint256 jobId,
        address approver
    ) external view returns (bool) {
        return votes[jobId].hasVoted[approver];
    }

    function voteCounts(
        uint256 jobId
    ) external view returns (uint256 approveCount, uint256 rejectCount, bool executed) {
        Vote storage v = votes[jobId];
        return (v.approveCount, v.rejectCount, v.executed);
    }
}
