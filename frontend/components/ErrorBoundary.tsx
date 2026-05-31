import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Catches JS render/runtime errors anywhere in the tree and shows the message
 * + stack instead of letting the app crash silently (as release builds do).
 * The text is selectable so it can be copied/screenshotted for debugging.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Also goes to device/Xcode logs.
    console.error("Unhandled error caught by ErrorBoundary:", error, info?.componentStack);
    this.setState({ info: info?.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
      >
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#EF4444", marginBottom: 12 }}>
          Something went wrong
        </Text>
        <Text selectable style={{ fontSize: 14, color: "#1F2937", marginBottom: 12 }}>
          {error.message}
        </Text>
        <Text selectable style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>
          {String(error.stack || "").slice(0, 1500)}
        </Text>
        {info ? (
          <Text selectable style={{ fontSize: 11, color: "#9CA3AF" }}>
            {info.slice(0, 1500)}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => this.setState({ error: null, info: null })}
          style={{
            marginTop: 20,
            backgroundColor: "#4DB6AC",
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>Try again</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }
}
