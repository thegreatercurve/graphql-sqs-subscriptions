# graphql-sqs-subscriptions

This package implements the PubSubEngine Interface from the [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) package. It allows you to connect your subscriptions manger to a AWS SQS (Simple Queue Service) queue.

## Installation

```bash
npm install graphql-sqs-subscriptions
```

or

```bash
yarn install graphql-sqs-subscriptions
```

## Usage

Define your GraphQL schema with a `Subscription` type:

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

type Subscription {
  fooAdded: Result
}

type Result {
  id: String
}
```

Create a simple `SQSPubSub` instance, passing in the URL for the relevant SQS queue, and your AWS API keys and region as separate config objects:

```js
import { SQSPubSub } from "graphql-sqs-subscriptions";

const pubsub = new SQSPubSub(
  {
    queueUrl: SQS_QUEUE_URL
  },
  {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION
  }
);
```

Now, implement your Subscription resolver, using the `pubsub.asyncIterator` method with the relevant trigger name:

```js
export const resolvers = {
  Subscription: {
    fooAdded: {
      subscribe: () => pubsub.asyncIterator("foo_added")
    }
  }
};
```

Calling the `asyncIterator` method will subscribe the `SQSPubSub` instance to listen/poll for any message on the SQS queue.

Any time `pubsub.publish` is then called, `SQSPubSub` will push a message on to the queue.

If the trigger name (i.e. `"foo_added"`) matches that which is passed to the `subscribe` method, the GraphQL subscription will push any resulting data to the subscribed client.

```js
pubsub.publish("foo_added", { fooAdded: { id: "123" } });
```

The SQS queue doesn't get created automatically, it has to be created beforehand.

## Author

[John Flockton (@thegreatercurve)](https://www.github.com/thegreatercurve)
