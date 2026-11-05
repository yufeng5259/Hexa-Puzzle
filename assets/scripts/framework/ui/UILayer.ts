/** BigHero ViewLayer reduced to the layers this game uses; values index UIRoot.layers. */
export enum UILayer { Page = 0, Popup = 1, Guide = 2, Toast = 3 }

/** BigHero ViewQueue: views in the same queue form a stack; opening hides the previous top. */
export enum UIQueue { Page = 0, Popup = 1, None = 2 }
