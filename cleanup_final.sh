#!/bin/bash

# Final cleanup script to reach <= 100MB target
# Removes unit tests and test libraries for production-focused repository

echo "Starting final cleanup to reach <= 100MB target..."
echo "Removing unit tests and test-only components..."

# Track current size
INITIAL_SIZE=$(du -sh . | cut -f1)
echo "Current repository size: $INITIAL_SIZE"

# --- Remove Unit Tests (11MB) ---
if [ -d "projects/biogears/libBiogears/unit" ]; then
    echo "Removing libBiogears unit tests: projects/biogears/libBiogears/unit/ (11MB)"
    rm -rf "projects/biogears/libBiogears/unit"
fi

# --- Remove Circuit Test Library (1.3MB) ---
if [ -d "projects/biogears/libCircuitTest" ]; then
    echo "Removing circuit test library: projects/biogears/libCircuitTest/ (1.3MB)"
    rm -rf "projects/biogears/libCircuitTest"
fi

# --- Remove Unit Test Project (28KB) ---
if [ -d "projects/unit" ]; then
    echo "Removing unit test project: projects/unit/ (28KB)"
    rm -rf "projects/unit"
fi

# --- Remove Large Data Templates if Needed (296KB) ---
# Templates might not be essential for core engine operation
if [ -d "share/data/templates" ]; then
    echo "Removing data templates: share/data/templates/ (296KB)"
    rm -rf "share/data/templates"
fi

# Calculate final size
echo ""
FINAL_SIZE=$(du -sh . | cut -f1)
FILE_COUNT=$(find . -type f | wc -l)

echo "=== FINAL CLEANUP COMPLETE ==="
echo "Previous size: $INITIAL_SIZE"
echo "Final size: $FINAL_SIZE"
echo "Total files: $FILE_COUNT"
echo ""

# Check if we reached the target
if [[ "$FINAL_SIZE" =~ ^[0-9]+M$ ]] && [[ "${FINAL_SIZE%M}" -le 100 ]]; then
    echo "✅ SUCCESS: Repository size is now <= 100MB"
    echo ""
    echo "Production-ready repository contains:"
    echo "- Core BioGears physiology engine (libBiogears/src + libBiogears/include)"
    echo "- Common Data Model (libCDM)"
    echo "- I/O utilities (libIO)"  
    echo "- Essential patient and substance data"
    echo "- Core configuration files"
    echo "- CMake build system"
    echo ""
    echo "Removed for production focus:"
    echo "- All unit tests and test frameworks"
    echo "- Documentation and validation datasets"
    echo "- Example projects and tutorials"
    echo "- Language bindings and external dependencies"
    echo "- Development and debugging tools"
else
    echo "⚠️  Repository size: $FINAL_SIZE (target was <= 100MB)"
    echo "Additional cleanup may be needed if further reduction is required."
fi