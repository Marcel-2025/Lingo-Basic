import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

// Let NativeWind style third-party components through `className`.
cssInterop(LinearGradient, { className: "style" });
