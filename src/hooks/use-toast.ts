import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;
const TOAST_AUTO_DISMISS_MS = 5000;
const ACTIVE_TOAST_ID = "active-toast";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastRemovalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
let toastAutoDismissTimeout: ReturnType<typeof setTimeout> | null = null;

const clearRemoveQueue = (toastId: string) => {
  const timeout = toastRemovalTimeouts.get(toastId);
  if (!timeout) return;
  clearTimeout(timeout);
  toastRemovalTimeouts.delete(toastId);
};

const addToRemoveQueue = (toastId: string) => {
  if (toastRemovalTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastRemovalTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastRemovalTimeouts.set(toastId, timeout);
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST": {
      clearRemoveQueue(action.toast.id);
      return {
        ...state,
        toasts: [action.toast].slice(0, TOAST_LIMIT),
      };
    }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = ACTIVE_TOAST_ID;

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => {
    if (toastAutoDismissTimeout) {
      clearTimeout(toastAutoDismissTimeout);
      toastAutoDismissTimeout = null;
    }
    dispatch({ type: "DISMISS_TOAST", toastId: id });
  };

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  if (toastAutoDismissTimeout) {
    clearTimeout(toastAutoDismissTimeout);
  }
  toastAutoDismissTimeout = setTimeout(() => {
    toastAutoDismissTimeout = null;
    dispatch({ type: "DISMISS_TOAST", toastId: id });
  }, TOAST_AUTO_DISMISS_MS);

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      if (!toastId || toastId === ACTIVE_TOAST_ID) {
        if (toastAutoDismissTimeout) {
          clearTimeout(toastAutoDismissTimeout);
          toastAutoDismissTimeout = null;
        }
      }
      dispatch({ type: "DISMISS_TOAST", toastId });
    },
  };
}

export { useToast };
