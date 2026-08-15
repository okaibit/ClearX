// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IACPHook {
    function beforeAction(
        uint256 jobId,
        bytes4 selector,
        bytes calldata data
    ) external;

    function afterAction(
        uint256 jobId,
        bytes4 selector,
        bytes calldata data
    ) external;
}

contract AgenticCommerce is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        JobStatus status;
        address hook;
        bytes32 deliverable;
    }

    IERC20 public immutable paymentToken;
    uint256 public nextJobId = 1;

    mapping(uint256 => Job) public jobs;

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed provider,
        address evaluator,
        uint256 expiredAt,
        address hook
    );

    event ProviderSet(
        uint256 indexed jobId,
        address indexed provider
    );

    event BudgetSet(
        uint256 indexed jobId,
        uint256 amount
    );

    event JobFunded(
        uint256 indexed jobId,
        address indexed client,
        uint256 amount
    );

    event JobSubmitted(
        uint256 indexed jobId,
        address indexed provider,
        bytes32 deliverable
    );

    event JobCompleted(
        uint256 indexed jobId,
        address indexed evaluator,
        bytes32 reason
    );

    event JobRejected(
        uint256 indexed jobId,
        address indexed rejector,
        bytes32 reason
    );

    event JobExpired(uint256 indexed jobId);

    event PaymentReleased(
        uint256 indexed jobId,
        address indexed provider,
        uint256 amount
    );

    event Refunded(
        uint256 indexed jobId,
        address indexed client,
        uint256 amount
    );

    error InvalidJob();
    error WrongStatus();
    error Unauthorized();
    error ZeroAddress();
    error ExpiryNotFuture();
    error ZeroBudget();
    error ProviderNotSet();
    error BudgetMismatch();
    error NotExpired();
    error ProviderAlreadySet();

    constructor(address paymentToken_) {
        if (paymentToken_ == address(0)) revert ZeroAddress();
        paymentToken = IERC20(paymentToken_);
    }

    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256 jobId) {
        if (evaluator == address(0)) revert ZeroAddress();
        if (expiredAt <= block.timestamp) revert ExpiryNotFuture();

        jobId = nextJobId++;

        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            description: description,
            budget: 0,
            expiredAt: expiredAt,
            status: JobStatus.Open,
            hook: hook,
            deliverable: bytes32(0)
        });

        emit JobCreated(
            jobId,
            msg.sender,
            provider,
            evaluator,
            expiredAt,
            hook
        );
    }

    function setProvider(
        uint256 jobId,
        address provider,
        bytes calldata
    ) external {
        Job storage job = _job(jobId);

        if (job.status != JobStatus.Open) revert WrongStatus();
        if (msg.sender != job.client) revert Unauthorized();
        if (job.provider != address(0)) revert ProviderAlreadySet();
        if (provider == address(0)) revert ZeroAddress();

        job.provider = provider;

        emit ProviderSet(jobId, provider);
    }

    function setBudget(
        uint256 jobId,
        uint256 amount,
        bytes calldata
    ) external {
        Job storage job = _job(jobId);

        if (job.status != JobStatus.Open) revert WrongStatus();
        if (msg.sender != job.client && msg.sender != job.provider) {
            revert Unauthorized();
        }
        if (amount == 0) revert ZeroBudget();

        job.budget = amount;

        emit BudgetSet(jobId, amount);
    }

    function fund(
        uint256 jobId,
        bytes calldata
    ) external nonReentrant {
        Job storage job = _job(jobId);

        if (job.status != JobStatus.Open) revert WrongStatus();
        if (msg.sender != job.client) revert Unauthorized();
        if (job.provider == address(0)) revert ProviderNotSet();
        if (job.budget == 0) revert ZeroBudget();

        paymentToken.safeTransferFrom(
            msg.sender,
            address(this),
            job.budget
        );

        job.status = JobStatus.Funded;

        emit JobFunded(
            jobId,
            msg.sender,
            job.budget
        );
    }

    function submit(
        uint256 jobId,
        bytes32 deliverable,
        bytes calldata
    ) external {
        Job storage job = _job(jobId);

        if (job.status != JobStatus.Funded) revert WrongStatus();
        if (msg.sender != job.provider) revert Unauthorized();

        job.deliverable = deliverable;
        job.status = JobStatus.Submitted;

        emit JobSubmitted(
            jobId,
            msg.sender,
            deliverable
        );
    }

    function complete(
        uint256 jobId,
        bytes32 reason,
        bytes calldata
    ) external nonReentrant {
        Job storage job = _job(jobId);

        if (job.status != JobStatus.Submitted) revert WrongStatus();
        if (msg.sender != job.evaluator) revert Unauthorized();

        job.status = JobStatus.Completed;

        uint256 amount = job.budget;

        paymentToken.safeTransfer(
            job.provider,
            amount
        );

        emit JobCompleted(
            jobId,
            msg.sender,
            reason
        );

        emit PaymentReleased(
            jobId,
            job.provider,
            amount
        );
    }

    function reject(
        uint256 jobId,
        bytes32 reason,
        bytes calldata
    ) external nonReentrant {
        Job storage job = _job(jobId);

        if (job.status == JobStatus.Open) {
            if (msg.sender != job.client) revert Unauthorized();
        } else if (
            job.status == JobStatus.Funded ||
            job.status == JobStatus.Submitted
        ) {
            if (msg.sender != job.evaluator) revert Unauthorized();
        } else {
            revert WrongStatus();
        }

        JobStatus previousStatus = job.status;
        job.status = JobStatus.Rejected;

        uint256 amount = job.budget;

        if (
            previousStatus == JobStatus.Funded ||
            previousStatus == JobStatus.Submitted
        ) {
            if (amount > 0) {
                paymentToken.safeTransfer(
                    job.client,
                    amount
                );

                emit Refunded(
                    jobId,
                    job.client,
                    amount
                );
            }
        }

        emit JobRejected(
            jobId,
            msg.sender,
            reason
        );
    }

    function claimRefund(
        uint256 jobId
    ) external nonReentrant {
        Job storage job = _job(jobId);

        if (
            job.status != JobStatus.Funded &&
            job.status != JobStatus.Submitted
        ) {
            revert WrongStatus();
        }

        if (block.timestamp < job.expiredAt) {
            revert NotExpired();
        }

        job.status = JobStatus.Expired;

        uint256 amount = job.budget;

        paymentToken.safeTransfer(
            job.client,
            amount
        );

        emit JobExpired(jobId);

        emit Refunded(
            jobId,
            job.client,
            amount
        );
    }

    function _job(uint256 jobId)
        internal
        view
        returns (Job storage job)
    {
        job = jobs[jobId];

        if (job.id == 0) revert InvalidJob();
    }
}
