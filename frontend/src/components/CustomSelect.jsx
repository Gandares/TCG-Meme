import { useEffect, useId, useRef, useState } from "react";

export function CustomSelect({ label, options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const listId = useId();
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!selectRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectOption(nextValue) {
    onChange?.(nextValue);
    setIsOpen(false);
  }

  function handleButtonKeyDown(event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === selectedOption?.value));
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    selectOption(options[nextIndex].value);
  }

  return (
    <span className={`select-shell${isOpen ? " open" : ""}`} ref={selectRef}>
      <button
        className="select-button"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
      >
        <span>{selectedOption?.label || label}</span>
      </button>
      {isOpen ? (
        <span className="select-options" id={listId} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              className={`select-option${option.value === selectedOption?.value ? " selected" : ""}`}
              type="button"
              role="option"
              aria-selected={option.value === selectedOption?.value}
              key={option.value}
              onClick={() => selectOption(option.value)}
            >
              {option.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
