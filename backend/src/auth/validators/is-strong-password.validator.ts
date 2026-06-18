import {
  registerDecorator,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from "class-validator";
import { zxcvbn } from "zxcvbn-ts";

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isStrongPassword",
      target: object.constructor,
      propertyName,
      options: {
        message:
          "Password is too weak. Choose a stronger password with a mix of characters.",
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          const result = zxcvbn(value);
          return result.score >= 1;
        },
        defaultMessage: () =>
          "Password is too weak. Choose a stronger password with a mix of characters.",
      } satisfies ValidatorConstraintInterface,
    });
  };
}
