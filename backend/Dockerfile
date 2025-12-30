
# 1. Use an official Python runtime as a parent image
FROM python:3.10-slim

# 2. Set the working directory inside the container
WORKDIR /code

# 3. Copy requirements.txt to the container
COPY requirements.txt .

# 4. Install dependencies
# --no-cache-dir keeps the image small
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# 5. Copy the rest of the backend code
COPY . .

# 6. Expose the port the app runs on
EXPOSE 8000

# 7. Command to run the application
# Render provides the PORT environment variable automatically.
# We use ${PORT:-8000} to default to 8000 if PORT isn't set (useful for local testing).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]