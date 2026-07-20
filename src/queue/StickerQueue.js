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
    if (!this.jobIdToPromise.has(jobId)) {
      return -1;
    }

    const isPending = this.queue.size > 0;
    if (isPending) {
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
