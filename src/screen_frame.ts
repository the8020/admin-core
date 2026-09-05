import { Model } from "/p/the8020/uui/mod.ts";

/** One navigation entry retains its screen instance while its data is refreshed. */
export class ScreenFrame {
  #model: Model<object> | undefined;
  #context: object | undefined;

  /** Program-owned navigation context, such as the current backend batch cursor. */
  context<T extends object>(initial: T): T {
    this.#context ??= initial;
    return this.#context as T;
  }

  model<T extends object>(data: T): Model<T> {
    this.#model ??= new Model(data);
    this.#model.data = data;
    return this.#model as Model<T>;
  }
}
