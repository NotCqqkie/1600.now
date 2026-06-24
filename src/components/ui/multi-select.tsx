import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Option = {
  label: string
  value: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  hideSearch?: boolean
  portalContainer?: HTMLElement | null
  demoControl?: string
  demoOptionPrefix?: string
  closeOnSelect?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  preserveOpenOnInteractOutside?: boolean
  preventAutoFocusScroll?: boolean
}

const commandItemClassName = [
  "transition-colors",
  "hover:bg-primary/15 hover:text-white hover:[&_svg]:text-white",
  "active:bg-cobalt active:text-white active:[&_svg]:text-white",
  "data-[selected='true']:bg-primary/15 data-[selected='true']:text-white",
  "data-[selected=true]:bg-primary/15 data-[selected=true]:text-white",
  "data-[selected='true']:[&_svg]:text-white data-[selected=true]:[&_svg]:text-white",
  "dark:hover:bg-primary/15 dark:hover:text-white dark:hover:[&_svg]:text-white",
  "dark:data-[selected='true']:bg-primary/15 dark:data-[selected='true']:text-white",
  "dark:data-[selected=true]:bg-primary/15 dark:data-[selected=true]:text-white",
  "dark:data-[selected='true']:[&_svg]:text-white dark:data-[selected=true]:[&_svg]:text-white",
].join(" ")

const selectedItemClassName = [
  "bg-primary/15 text-white [&_svg]:text-white",
  "hover:!bg-cobalt hover:!text-white hover:[&_svg]:!text-white",
  "active:!bg-cobalt active:!text-white active:[&_svg]:!text-white",
  "dark:text-white",
].join(" ")

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
  hideSearch = false,
  portalContainer,
  demoControl,
  demoOptionPrefix,
  closeOnSelect = false,
  open: controlledOpen,
  onOpenChange,
  preserveOpenOnInteractOutside = false,
  preventAutoFocusScroll = false,
}: MultiSelectProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  const selectedLabels = selected
    .map((val) => options.find((option) => option.value === val)?.label || val)
    .filter(Boolean)

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selectedLabels.join(", ")
        : `${selected.length} selected`

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
    if (closeOnSelect) setOpen(false)
  }
  const usePlainList = hideSearch && preventAutoFocusScroll

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-filter-demo-control={demoControl}
          className={cn("w-full justify-between gap-2 overflow-hidden", className)}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {triggerLabel}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={preventAutoFocusScroll ? (event) => event.preventDefault() : undefined}
        onCloseAutoFocus={preventAutoFocusScroll ? (event) => event.preventDefault() : undefined}
        onInteractOutside={preserveOpenOnInteractOutside ? (event) => event.preventDefault() : undefined}
      >
        {usePlainList ? (
          <div className="max-h-64 overflow-auto p-1" role="listbox">
            {options.map((option) => {
              const isSelected = selected.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-filter-demo-option={demoOptionPrefix ? `${demoOptionPrefix}:${option.value}` : undefined}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                    commandItemClassName,
                    isSelected && selectedItemClassName,
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </button>
              )
            })}
          </div>
        ) : (
          <Command>
            {!hideSearch && <CommandInput placeholder="Search..." />}
            <CommandList>
              <CommandEmpty>No item found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    data-filter-demo-option={demoOptionPrefix ? `${demoOptionPrefix}:${option.value}` : undefined}
                    className={cn(
                      commandItemClassName,
                      selected.includes(option.value) && selectedItemClassName,
                    )}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
