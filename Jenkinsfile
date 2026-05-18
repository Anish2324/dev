pipeline {
    agent any

    tools {
        nodejs 'nodejs'
    }

    environment {
        IMAGE_NAME = "anvesh1605/simple-devops-app"
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

                script {

                    def scannerHome = tool 'sonar-scanner'

                    withCredentials([string(
                        credentialsId: 'sonar-token',
                        variable: 'SONAR_TOKEN'
                    )]) {

                        bat """
                        ${scannerHome}\\bin\\sonar-scanner.bat ^
                        -Dsonar.projectKey=anvesh1605_simple-devops-app ^
                        -Dsonar.organization=anvesh1605 ^
                        -Dsonar.sources=. ^
                        -Dsonar.host.url=https://sonarcloud.io ^
                        -Dsonar.login=%SONAR_TOKEN%
                        """
                    }
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