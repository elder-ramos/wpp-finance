const PQueue = require("p-queue").default;

class StickerQueue {
  constructor(concurrency = 3) {
    this.queue = new PQueue({ concurrency });
    this.jobIdToPromise = new Map();
    this.jobIdToTime = new Map();
  }

  getQueueSize() {
    return this.queue.size;
  }

  getPosition(jobId) {
    // If job is not in our tracking, return -1
    if (!this.jobIdToPromise.has(jobId)) {
      return -1;
    }

    // If currently running (promise exists but not in queue.size), return 0
    // Otherwise return position in queue (queue.size is number of pending jobs)
    // Position = queue size at time of query approximates position
    const isPending = this.queue.size > 0;
    if (isPending) {
      // Rough approximation: position is based on how many jobs are pending
      // In a real system, we'd track exact position, but p-queue doesn't expose this
      // So we return: if job is in flight, return 0; if pending, return queue size
      return this.queue.size;
    }
    return 0;
  }

  async enqueue(jobFn, jobId) {
    const startTime = Date.now();
    this.jobIdToTime.set(jobId, startTime);

    const promise = this.queue.add(async () => {
      try {
        return await jobFn();
      } finally {
        this.jobIdToPromise.delete(jobId);
        this.jobIdToTime.delete(jobId);
      }
    });

    this.jobIdToPromise.set(jobId, promise);

    return promise;
  }
}

module.exports = StickerQueue;
