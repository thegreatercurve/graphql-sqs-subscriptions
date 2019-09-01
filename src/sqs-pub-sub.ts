import { AWSError, SQS } from "aws-sdk";
import { PubSubEngine } from "graphql-subscriptions";
import { PubSubAsyncIterator } from "graphql-subscriptions/dist/pubsub-async-iterator";
import { delay } from "./utils";

const AWS_SDK_API_VERSION = "2012-11-05";
const PUB_SUB_MESSAGE_ATTRIBUTE = "SQSPubSubTriggerName";

interface PubSubOptions {
  queueUrl: string;
  receiveMessageTimeout?: number;
}

export class SQSPubSub implements PubSubEngine {
  public sqs: SQS;

  private readonly receiveMessageTimeout: number;
  private readonly queueUrl: string;
  private stopped: boolean;
  private triggerName: string;

  public constructor(
    { queueUrl, receiveMessageTimeout = 0 }: PubSubOptions,
    config: SQS.Types.ClientConfiguration = {}
  ) {
    this.sqs = new SQS({ apiVersion: AWS_SDK_API_VERSION });

    this.sqs.config.update(config);

    this.queueUrl = queueUrl;
    this.receiveMessageTimeout = receiveMessageTimeout;
  }

  public asyncIterator = <T>(triggers: string | string[]): AsyncIterator<T> => {
    return new PubSubAsyncIterator<T>(this, triggers);
  };

  public deleteMessage = async (receiptHandle: string): Promise<void> => {
    const params = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    };

    try {
      await this.sqs
        .deleteMessage(params, (err: AWSError) => {
          if (err) {
            throw err;
          }
        })
        .promise();
    } catch (error) {
      throw Error(error.message);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public publish = async (triggerName: string, payload: any): Promise<void> => {
    if (this.triggerName) {
      this.triggerName = triggerName;
    }

    const params: SQS.Types.SendMessageRequest = {
      QueueUrl: this.queueUrl,
      MessageAttributes: {
        [PUB_SUB_MESSAGE_ATTRIBUTE]: {
          DataType: "String",
          StringValue: this.triggerName
        }
      },
      MessageBody: JSON.stringify(payload)
    };

    try {
      await this.sqs
        .sendMessage(params, (err: AWSError) => {
          if (err) {
            throw err;
          }
        })
        .promise();
    } catch (error) {
      throw Error(error.message);
    }
  };

  public subscribe = (
    triggerName: string,
    onMessage: Function,
    options?: SQS.Types.ReceiveMessageRequest
  ): Promise<number> => {
    if (this.triggerName) {
      this.triggerName = triggerName;
    }

    try {
      this.poll(onMessage, options);

      return Promise.resolve(1);
    } catch (error) {
      throw Error(error.message);
    }
  };

  public unsubscribe = (): void => {
    if (this.stopped) {
      this.stopped = true;
    }
  };

  private readonly poll = async (
    onMessage: Function,
    options: SQS.Types.ReceiveMessageRequest
  ): Promise<void> => {
    const params = {
      ...(options || options),
      MessageAttributeNames: [PUB_SUB_MESSAGE_ATTRIBUTE],
      QueueUrl: this.queueUrl,
      VisibilityTimeout: 0
    };

    const data = await this.receiveMessage(params);

    if (
      data.Messages &&
      data.Messages.length > 0 &&
      data.Messages[0].MessageAttributes[PUB_SUB_MESSAGE_ATTRIBUTE]
        .StringValue === this.triggerName
    ) {
      await this.deleteMessage(data.Messages[0].ReceiptHandle);

      onMessage(JSON.parse(data.Messages[0].Body));
    }

    if (this.stopped) {
      return;
    }

    await delay(
      () => this.poll(onMessage, options),
      this.receiveMessageTimeout
    );
  };

  private readonly receiveMessage = async (
    params: SQS.Types.ReceiveMessageRequest
  ): Promise<SQS.Types.ReceiveMessageResult> => {
    try {
      return await this.sqs
        .receiveMessage(params, (err: AWSError) => {
          if (err) {
            throw err;
          }
        })
        .promise();
    } catch (error) {
      throw Error(error.message);
    }
  };
}
