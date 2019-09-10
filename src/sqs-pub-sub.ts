import aws, { AWSError, SQS } from "aws-sdk";
import { PubSubEngine } from "graphql-subscriptions";
import { PubSubAsyncIterator } from "graphql-subscriptions/dist/pubsub-async-iterator";
import uuid from "uuid";
import { errorHandler } from "./utils";

const AWS_SDK_API_VERSION = "2012-11-05";
const PUB_SUB_MESSAGE_ATTRIBUTE = "SQSPubSubTriggerName";

export class SQSPubSub implements PubSubEngine {
  public sqs: SQS;

  private queueUrl: string;
  private stopped: boolean;
  private triggerName: string;

  public constructor(config: SQS.Types.ClientConfiguration = {}) {
    aws.config.update(config);

    this.sqs = new aws.SQS({ apiVersion: AWS_SDK_API_VERSION });
  }

  public asyncIterator = <T>(triggers: string | string[]): AsyncIterator<T> => {
    return new PubSubAsyncIterator<T>(this, triggers);
  };

  public createQueue = async (): Promise<void> => {
    const params = {
      QueueName: `${process.env.NODE_ENV || "local"}-${uuid()}.fifo`,
      Attributes: {
        FifoQueue: "true"
      }
    };

    try {
      await this.sqs
        .createQueue(
          params,
          (err: AWSError, { QueueUrl = "" }: SQS.Types.CreateQueueResult) => {
            if (err) {
              console.error(err);
            }

            this.queueUrl = QueueUrl;
          }
        )
        .promise();
    } catch (error) {
      console.error(error);
    }
  };

  public deleteQueue = async (): Promise<void> => {
    const params = {
      QueueUrl: this.queueUrl
    };

    try {
      await this.sqs.deleteQueue(params, errorHandler).promise();

      this.queueUrl = null;
    } catch (error) {
      console.error(error);
    }
  };

  public deleteMessage = async (receiptHandle: string): Promise<void> => {
    const params = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    };

    try {
      await this.sqs.deleteMessage(params, errorHandler).promise();
    } catch (error) {
      console.error(error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public publish = async (triggerName: string, payload: any): Promise<void> => {
    try {
      if (!this.queueUrl) {
        await this.createQueue();
      }

      const params: SQS.Types.SendMessageRequest = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: triggerName,
        MessageDeduplicationId: uuid(),
        MessageAttributes: {
          [PUB_SUB_MESSAGE_ATTRIBUTE]: {
            DataType: "String",
            StringValue: triggerName
          }
        }
      };

      await this.sqs.sendMessage(params, errorHandler).promise();
    } catch (error) {
      console.error(error);
    }
  };

  public subscribe = (
    triggerName: string,
    onMessage: Function
  ): Promise<number> => {
    try {
      this.poll(triggerName, onMessage);

      return Promise.resolve(1);
    } catch (error) {
      console.error(error);
    }
  };

  public unsubscribe = async (): Promise<void> => {
    if (!this.stopped) {
      this.stopped = true;

      try {
        await this.deleteQueue();
      } catch (error) {
        console.error(error);
      }

      this.stopped = false;
    }
  };

  private readonly poll = async (
    triggerName: string,
    onMessage: Function
  ): Promise<void> => {
    if (this.stopped) {
      return;
    }

    try {
      if (!this.queueUrl) {
        await this.createQueue();
      }

      const params = {
        MessageAttributeNames: [PUB_SUB_MESSAGE_ATTRIBUTE],
        QueueUrl: this.queueUrl
      };

      const data = await this.receiveMessage(params);

      if (
        data &&
        data.Messages &&
        data.Messages[0].MessageAttributes[PUB_SUB_MESSAGE_ATTRIBUTE]
          .StringValue === triggerName
      ) {
        await this.deleteMessage(data.Messages[0].ReceiptHandle);

        onMessage(JSON.parse(data.Messages[0].Body));
      }
    } catch (error) {
      console.error(error);
    }

    setImmediate(() => this.poll(triggerName, onMessage));
  };

  private readonly receiveMessage = async (
    params: SQS.Types.ReceiveMessageRequest
  ): Promise<SQS.Types.ReceiveMessageResult> => {
    try {
      return await this.sqs.receiveMessage(params, errorHandler).promise();
    } catch (error) {
      console.error(error);
    }
  };
}
