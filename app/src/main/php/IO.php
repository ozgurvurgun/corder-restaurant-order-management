<?php

class IO
{
    public function fileRecord($file, string $fileName, string $targetDir, array $allowedTypes): bool
    {
        $target_file = rtrim($targetDir, '/') . '/' . $fileName;
        $control_target_file = rtrim($targetDir, '/') . '/' . $file['name'];
        $fileType = strtolower(pathinfo($control_target_file, PATHINFO_EXTENSION));
        if (!$this->checkFileType($fileType, $allowedTypes)) return false;
        if (move_uploaded_file($file["tmp_name"], $target_file)) {
            return true;
        } else {
            return false;
        }
    }

    public function checkFileType($fileType, $allowedTypes): bool
    {
        return in_array($fileType, $allowedTypes);
    }
}
