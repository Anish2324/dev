pipeline {
    agent any

    tools {
        nodejs 'nodejs'
        sonarQubeScanner 'sonar-scanner'
    }

    environment {
        IMAGE_NAME = "YOUR_DOCKERHUB_USERNAME/simple-devops-app"
    }

    stages {

        stage('Clone') {
            steps {
                echo 'Repository already loaded by Jenkins'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('SonarCloud Scan') {
            steps {
                withCredentials([string(
                    credentialsId: 'sonar-token',
                    variable: 'SONAR_TOKEN'
                )]) {

                    bat '''
                    sonar-scanner ^
                    -Dsonar.projectKey=YOUR_PROJECT_KEY ^
                    -Dsonar.organization=YOUR_ORG ^
                    -Dsonar.sources=. ^
                    -Dsonar.host.url=https://sonarcloud.io ^
                    -Dsonar.login=%SONAR_TOKEN%
                    '''
                }
            }
        }

        stage('Dependency Check') {
            steps {
                bat '''
                dependency-check.bat ^
                --project "simple-devops-app" ^
                --scan . ^
                --format HTML ^
                --out dependency-check-report
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                bat 'docker build -t %IMAGE_NAME% .'
            }
        }

        stage('Push Docker Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {

                    bat 'docker login -u %DOCKER_USER% -p %DOCKER_PASS%'
                    bat 'docker push %IMAGE_NAME%'
                }
            }
        }

        stage('Deploy') {
            steps {
                echo 'Render deployment enabled'
            }
        }
    }
}