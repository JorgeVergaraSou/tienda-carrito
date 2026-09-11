import { configureStore } from "@reduxjs/toolkit";
import { UserInfo } from "@/models";
import userSliceReducer from "./states/user";
import cartSliceReducer, { CartState } from "./states/cart";

export interface AppStore {
    user: UserInfo;
    cart: CartState;
}

export default configureStore<AppStore>({
    reducer: {
        user: userSliceReducer,
        cart: cartSliceReducer
    }
})
