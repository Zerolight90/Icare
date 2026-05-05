# 1. 노드 환경 준비
FROM node:20-slim

# 2. 작업 폴더 만들기
WORKDIR /app

# 3. 설정 파일 복사 및 라이브러리 설치
COPY package*.json ./
RUN npm install

# 4. 소스 코드 복사 및 빌드
COPY . .
ARG BACKEND_URL=http://localhost:8080
ENV BACKEND_URL=$BACKEND_URL
RUN npm run build

# 5. 3000 포트 열기
EXPOSE 3000

# 6. 실행!
CMD ["npm", "start"]