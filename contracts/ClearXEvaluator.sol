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

contract ClearXEvaluator {
    address public owner;
    IAgenticCommerce public immutable commerce;

    error Unauthorized();

    event EvidenceVerified(
        uint256 indexed jobId,
        bytes32 indexed evidenceHash,
        bool approved
    );

    constructor(address commerce_) {
        if (commerce_ == address(0)) revert Unauthorized();

        owner = msg.sender;
        commerce = IAgenticCommerce(commerce_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function approve(
        uint256 jobId,
        bytes32 evidenceHash
    ) external onlyOwner {
        emit EvidenceVerified(
            jobId,
            evidenceHash,
            true
        );

        commerce.complete(
            jobId,
            evidenceHash,
            ""
        );
    }

    function reject(
        uint256 jobId,
        bytes32 evidenceHash
    ) external onlyOwner {
        emit EvidenceVerified(
            jobId,
            evidenceHash,
            false
        );

        commerce.reject(
            jobId,
            evidenceHash,
            ""
        );
    }
}
