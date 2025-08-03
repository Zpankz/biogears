#!/bin/bash

# This script removes files and directories related to the Java GUI,
# JNI bindings, and non-macOS build configurations from the BioGears repository.

echo "Starting BioGears repository cleanup for macOS C++ focus..."

# --- Phase 1: File and Directory Deletion ---

# 1. Remove the GUI source code
if [ -d "src/gui" ]; then
    echo "Removing GUI source directory: src/gui/"
    rm -rf "src/gui"
else
    echo "Directory src/gui not found, skipping."
fi

# 2. Remove Java-related projects and files
# Assuming Eclipse project files are in the root or a dedicated java folder.
# This also targets known Java utility classes mentioned in the documentation.
echo "Searching for and removing Java source files and Eclipse project files..."
find . -type f \( -name "*.java" -o -name ".project" -o -name ".classpath" \) -print -delete

# 3. Remove non-macOS/Xcode build and deployment scripts
echo "Removing build scripts for Windows, Linux, and Raspberry Pi..."
rm -f src/deploy-unix-executable.sh
rm -f src/deploy-linux-library.sh
rm -f src/build-linux.sh
# Add other specific files if they exist, e.g., .bat or non-macOS .sh scripts

# 4. Remove SWIG bindings for non-macOS platforms (keeping only essential ones)
echo "Cleaning up SWIG bindings and language wrappers that are not needed for macOS C++ focus..."
if [ -d "projects/biogears/swig_bindings/not_implemented" ]; then
    echo "Removing not_implemented SWIG bindings: projects/biogears/swig_bindings/not_implemented/"
    rm -rf "projects/biogears/swig_bindings/not_implemented"
else
    echo "Directory projects/biogears/swig_bindings/not_implemented not found, skipping."
fi

# 5. Remove Docker and container-related files (as they're typically for Linux deployment)
echo "Removing Docker and container-related files..."
rm -f docker-compose.yml
rm -rf docker

# 6. Remove Windows/Linux specific build configurations
echo "Removing cross-platform build artifacts..."
find . -name "*.bat" -print -delete
find . -name "*linux*" -type f -print -delete
find . -name "*windows*" -type f -print -delete
find . -name "*mingw*" -type f -print -delete

echo "Physical file cleanup complete."
echo "---"
echo "Next steps:"
echo "1. Review the CMakeLists.txt files to remove references to deleted components"
echo "2. Test the build system with: cmake -S . -B build -DCMAKE_BUILD_TYPE=Release"
echo "3. Verify all C++ targets still build correctly"
echo "---"
echo "Action Required: Please proceed to manually edit the CMake files as instructed."