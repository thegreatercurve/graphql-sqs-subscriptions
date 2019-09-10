import { AWSError } from "aws-sdk";

export const errorHandler = (err: AWSError): void => {
  if (err) {
    console.error(err);
  }
};
